import { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import { ChangeStackDraftingBegan } from '@change-review/domain/events/change-stack-drafting-began.event';
import { ChangeStackFailed } from '@change-review/domain/events/change-stack-failed.event';
import { ChangeStackReady } from '@change-review/domain/events/change-stack-ready.event';
import { ChangeStackReordered } from '@change-review/domain/events/change-stack-reordered.event';
import { ChangeStackReorderingEnded } from '@change-review/domain/events/change-stack-reordering-ended.event';
import { ReplayStackCompleted } from '@change-review/domain/events/replay-stack-completed.event';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { NoStackForSearchesError } from '@change-review/domain/exceptions/no-stack-for-searches.error';
import { arranged } from '@change-review/domain/services/arrange-stack';
import { checkStepsOf } from '@change-review/domain/services/check-steps';
import { generatedEntries } from '@change-review/domain/services/generated-entries';
import { actsOutsideSpotlight } from '@change-review/domain/services/replay-isolation';
import { StackProposal } from '@change-review/domain/services/stack-proposal';
import { BaseCommit } from '@change-review/domain/value-objects/base-commit.vo';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type {
  CheckEntry,
  CheckStep,
} from '@change-review/domain/value-objects/stack-check.vo';
import type {
  ProposedCohort,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import type { LayerId } from '@change-review/domain/value-objects/stack-ids';
import {
  type ChangeStackState,
  INTERRUPTED,
  StackProgress,
} from '@change-review/domain/value-objects/stack-progress.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import {
  type ModelCall,
  ModelUsage,
} from '@shared-kernel/domain/value-objects/model-usage.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const NOT_DRAFTED = 'Spotlight couldn’t draft the change stack.';

const changeLayers = (
  stack: readonly { kind: string; layers: readonly unknown[] }[],
): number =>
  stack
    .filter((cohort) => cohort.kind === 'change')
    .reduce((total, cohort) => total + cohort.layers.length, 0);

const placedHunks = (cohorts: readonly StackCohort[]): string[] =>
  cohorts.flatMap((cohort) =>
    cohort.layers.flatMap((layer) => layer.ranges.map((range) => range.hunk)),
  );

const assertWhole = (
  progress: StackProgress,
  diff: Diff,
  cohorts: readonly StackCohort[],
): void => {
  const wrong = (problem: string): never => {
    throw new InconsistentStateError('change stack', problem);
  };

  if (progress.state === 'drafting' && cohorts.length > 0) {
    wrong('is still drafting, yet already has cohorts');
  }

  if (progress.state === 'failed' && !progress.failure) {
    wrong('failed without saying why');
  }

  if (progress.state !== 'ready') {
    return;
  }

  if (cohorts.length === 0) {
    wrong('is ready, yet places nothing');
  }

  const placed = placedHunks(cohorts);
  const counted = new Map<string, number>();

  for (const hunk of placed) {
    counted.set(hunk, (counted.get(hunk) ?? 0) + 1);
  }

  for (const [hunk, times] of counted) {
    if (times > 1) {
      wrong(`places ${hunk} ${times} times`);
    }
  }

  for (const hunk of diff.hunks) {
    if (!counted.has(hunk.id)) {
      wrong(`leaves ${hunk.id} out`);
    }
  }

  for (const hunk of counted.keys()) {
    if (!diff.hunks.some((each) => each.id === hunk)) {
      wrong(`places ${hunk}, which the diff does not contain`);
    }
  }
};

const assertOneOwner = (stack: {
  taskId: TaskId | null;
  replay: boolean;
}): void => {
  if (stack.replay && stack.taskId) {
    throw new InconsistentStateError(
      'change stack',
      'is a replay’s, yet belongs to a task',
    );
  }
};

export class ChangeStack
  extends EventRecorder
  implements HasPendingJob<ChangeStack>
{
  private constructor(
    readonly id: ChangeStackId,
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly replay: boolean,
    readonly workspaceId: WorkspaceId,
    readonly repository: RepositoryName | null,
    readonly base: BaseCommit | null,
    readonly diff: Diff,
    readonly facts: StackFacts,
    readonly cohorts: readonly StackCohort[],
    readonly progress: StackProgress,
    readonly job: PendingJob,
    readonly request: CheckRequest | null,
    readonly reordering: boolean,
    readonly spent: ModelUsage,
    readonly version: number,
  ) {
    super();
  }

  static draft(input: {
    id: ChangeStackId;
    runId: RunId;
    taskId: TaskId | null;
    replay: boolean;
    isSearch: boolean;
    workspaceId: WorkspaceId;
    repository: string | null;
    base: string | null;
    diff: Diff;
    facts: StackFacts;
    request: CheckRequest | null;
    now: Date;
  }): ChangeStack {
    if (input.isSearch) {
      throw new NoStackForSearchesError();
    }

    assertOneOwner(input);

    const stack = new ChangeStack(
      input.id,
      input.runId,
      input.taskId,
      input.replay,
      input.workspaceId,
      input.repository?.trim() ? RepositoryName.of(input.repository) : null,
      input.base?.trim() ? BaseCommit.of(input.base) : null,
      input.diff,
      input.facts,
      [],
      StackProgress.drafting(input.now),
      PendingJob.fresh(),
      input.request,
      false,
      ModelUsage.none(),
      0,
    );

    stack.record(new ChangeStackDraftingBegan(stack.id, stack.runId));

    return stack;
  }

  static rehydrate(input: {
    id: ChangeStackId;
    runId: RunId;
    taskId: TaskId | null;
    replay: boolean;
    workspaceId: WorkspaceId;
    repository: RepositoryName | null;
    base: BaseCommit | null;
    diff: Diff;
    facts: StackFacts;
    cohorts: readonly StackCohort[];
    progress: StackProgress;
    job: PendingJob;
    request: CheckRequest | null;
    reordering: boolean;
    spent: ModelUsage;
    version: number;
  }): ChangeStack {
    assertWhole(input.progress, input.diff, input.cohorts);
    assertOneOwner(input);

    return new ChangeStack(
      input.id,
      input.runId,
      input.taskId,
      input.replay,
      input.workspaceId,
      input.repository,
      input.base,
      input.diff,
      input.facts,
      input.cohorts,
      input.progress,
      input.job,
      input.request,
      input.reordering,
      input.spent,
      input.version,
    );
  }

  get state(): ChangeStackState {
    return this.progress.state;
  }

  get failure(): string | null {
    return this.progress.failure;
  }

  get draftedAt(): Date {
    return this.progress.draftedAt;
  }

  get completedAt(): Date | null {
    return this.progress.completedAt;
  }

  get postsToGitHub(): boolean {
    return actsOutsideSpotlight(this);
  }

  get hasPendingJob(): boolean {
    return this.state === 'drafting' || this.reordering;
  }

  get jobExhausted(): boolean {
    return this.job.exhausted;
  }

  entries(): readonly CheckEntry[] {
    return generatedEntries(this.diff, this.cohorts, this.facts);
  }

  layers(): readonly LayerId[] {
    return this.cohorts
      .filter((cohort) => cohort.kind === 'change')
      .flatMap((cohort) => cohort.layers)
      .map((layer) => layer.id);
  }

  checkSteps(entries: readonly CheckEntry[]): CheckStep[] {
    return checkStepsOf({
      hunks: this.diff.hunks.map((hunk) => hunk.id),
      facts: this.facts,
      cohorts: this.cohorts,
      entries,
    });
  }

  recordModel(call: ModelCall | null): ChangeStack {
    return call ? this.with({ spent: this.spent.with(call) }) : this;
  }

  requestReorder(): ChangeStack {
    return this.state === 'ready' && !this.reordering
      ? this.with({ reordering: true, job: PendingJob.fresh() })
      : this;
  }

  leaseJob(now: Date): ChangeStack {
    if (!this.hasPendingJob) {
      throw InvalidChangeStackError.because('has nothing to draft or reorder');
    }
    if (!this.job.isDue(now) || this.job.exhausted) {
      throw InvalidChangeStackError.because(
        'cannot be drafted or reordered again yet',
      );
    }

    return this.with({ job: this.job.lease(now) });
  }

  scheduleRetry(now: Date): ChangeStack {
    if (!this.hasPendingJob) {
      return this;
    }

    return this.job.exhausted
      ? this.deadLetter(now)
      : this.with({ job: this.job.scheduleRetry(now) });
  }

  deadLetter(now: Date): ChangeStack {
    if (this.state === 'drafting') {
      return this.fail(NOT_DRAFTED, now);
    }

    return this.stopReordering();
  }

  reordered(cohorts: readonly ProposedCohort[], now: Date): ChangeStack {
    if (!this.reordering) {
      throw InvalidChangeStackError.because('is not being reordered');
    }

    const setAside = arranged(this.diff, this.facts, cohorts);
    const before = changeLayers(this.cohorts);
    const after = changeLayers(setAside);

    const ready = StackProposal.validate({
      diff: this.diff,
      facts: this.facts,
      cohorts: setAside,
      also:
        after < before
          ? [
              {
                code: 'joined-layers',
                message: `joins layers, leaving ${after} where there were ${before}`,
              },
            ]
          : [],
    });

    const reordered = this.with({
      cohorts: ready,
      progress: this.progress.complete('ready', now),
      job: PendingJob.fresh(),
      reordering: false,
    });

    reordered.record(new ChangeStackReordered(this.id, this.runId));
    reordered.recordReady(now);
    return reordered;
  }

  stopReordering(): ChangeStack {
    if (!this.reordering) {
      return this;
    }

    const ended = this.with({ reordering: false, job: PendingJob.fresh() });
    ended.record(new ChangeStackReorderingEnded(this.id, this.runId));
    return ended;
  }

  propose(cohorts: readonly ProposedCohort[], now: Date): ChangeStack {
    this.assertDrafting();

    const ready = StackProposal.validate({
      diff: this.diff,
      facts: this.facts,
      cohorts: arranged(this.diff, this.facts, cohorts),
    });

    const completed = this.with({
      cohorts: ready,
      progress: this.progress.complete('ready', now),
      job: PendingJob.fresh(),
    });

    completed.record(
      new ChangeStackCompleted(this.id, this.runId, this.replay),
    );
    completed.recordReady(now);
    completed.recordReplayCompleted();
    return completed;
  }

  private recordReplayCompleted(): void {
    if (this.replay) {
      this.record(
        new ReplayStackCompleted(this.id, this.runId, this.workspaceId),
      );
    }
  }

  private recordReady(at: Date): void {
    if (!actsOutsideSpotlight(this)) {
      return;
    }

    this.record(
      new ChangeStackReady(
        this.id,
        this.runId,
        this.taskId,
        this.workspaceId,
        this.cohorts.map((each) => ({
          kind: each.kind,
          title: each.title,
          intent: each.intent,
        })),
        at,
      ),
    );
  }

  fail(reason: string, now: Date): ChangeStack {
    this.assertDrafting();

    const failure = reason.trim() || INTERRUPTED;

    const failed = this.with({
      progress: this.progress.complete('failed', now, { failure }),
      job: PendingJob.fresh(),
    });

    failed.record(new ChangeStackFailed(this.id, this.runId, failure));
    failed.recordReplayCompleted();

    return failed;
  }

  private assertDrafting(): void {
    if (this.state !== 'drafting') {
      throw InvalidChangeStackError.because(`is already ${this.state}`);
    }
  }

  private with(change: {
    cohorts?: readonly StackCohort[];
    progress?: StackProgress;
    job?: PendingJob;
    reordering?: boolean;
    spent?: ModelUsage;
  }): ChangeStack {
    const next = new ChangeStack(
      this.id,
      this.runId,
      this.taskId,
      this.replay,
      this.workspaceId,
      this.repository,
      this.base,
      this.diff,
      this.facts,
      change.cohorts ?? this.cohorts,
      change.progress ?? this.progress,
      change.job ?? this.job,
      this.request,
      change.reordering ?? this.reordering,
      change.spent ?? this.spent,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
