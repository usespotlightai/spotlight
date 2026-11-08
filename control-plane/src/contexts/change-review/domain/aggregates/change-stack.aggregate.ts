import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { ChangeStackBecameReady } from '@change-review/domain/events/change-stack-became-ready.event';
import { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import { ChangeStackRedrafted } from '@change-review/domain/events/change-stack-redrafted.event';
import { ChangeStackRedraftingEnded } from '@change-review/domain/events/change-stack-redrafting-ended.event';
import { TrialStackSettled } from '@change-review/domain/events/trial-stack-settled.event';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { NoStackOwnerError } from '@change-review/domain/exceptions/no-stack-owner.error';
import { NoStackWithoutCheckoutsError } from '@change-review/domain/exceptions/no-stack-without-checkouts.error';
import { UnknownQuestionError } from '@change-review/domain/exceptions/unknown-question.error';
import { arranged } from '@change-review/domain/services/arrange-stack';
import { checkStepsOf } from '@change-review/domain/services/check-steps';
import { placedHunks } from '@change-review/domain/services/diff-facts';
import { DraftedStack } from '@change-review/domain/services/drafted-stack';
import { generatedEntries } from '@change-review/domain/services/generated-entries';
import { PreviousStack } from '@change-review/domain/services/previous-stack';
import {
  type RedraftRequest,
  redraftRequestOf,
} from '@change-review/domain/services/redraft-request';
import { changeLayerCount } from '@change-review/domain/services/stack-checks';
import { assertOneOwner } from '@change-review/domain/services/stack-owner';
import { StackProposal } from '@change-review/domain/services/stack-proposal';
import { actsOutsideSpotlight } from '@change-review/domain/services/trial-isolation';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type {
  CheckEntry,
  CheckStep,
} from '@change-review/domain/value-objects/stack-check.vo';
import type {
  DraftedCohort,
  LayerQuestion,
  ProposedCohort,
  RemovedLayer,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import type {
  LayerId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
import {
  type ChangeStackState,
  type StackFailure,
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
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface CitedHunk {
  readonly path: string;
  readonly patch: string;
}

const baseOf = (raw: string): CommitSha => {
  const sha = CommitSha.parsed(raw);

  if (!sha) {
    throw InvalidChangeStackError.because(
      'base must be a full 40-character commit hash',
    );
  }

  return sha;
};

const assignedHunks = (cohorts: readonly StackCohort[]): string[] =>
  cohorts.flatMap((cohort) =>
    cohort.layers.flatMap((layer) => layer.hunks.map((entry) => entry.hunk)),
  );

const assertRevisedOnlyWithPrevious = (stack: {
  readonly previous: ChangeStackId | null;
  readonly cohorts: readonly StackCohort[];
  readonly removed: readonly RemovedLayer[];
}): void => {
  const revised =
    stack.removed.length > 0 ||
    stack.cohorts.some((cohort) =>
      cohort.layers.some((layer) => layer.revision !== null),
    );

  if (revised && !stack.previous) {
    throw new InconsistentStateError(
      'change stack',
      'is revised, yet follows no previous stack',
    );
  }
};

const assertComplete = (
  progress: StackProgress,
  diff: Diff,
  cohorts: readonly StackCohort[],
): void => {
  const wrong = (problem: string): never => {
    throw new InconsistentStateError('change stack', problem);
  };

  if (progress.state === 'generating' && cohorts.length > 0) {
    wrong('is still generating, yet already has cohorts');
  }

  if (progress.state !== 'ready') {
    return;
  }

  if (cohorts.length === 0) {
    wrong('is ready, yet assigns nothing');
  }

  const assigned = assignedHunks(cohorts);
  const counted = new Map<string, number>();

  for (const hunk of assigned) {
    counted.set(hunk, (counted.get(hunk) ?? 0) + 1);
  }

  for (const [hunk, times] of counted) {
    if (times > 1) {
      wrong(`assigns ${hunk} ${times} times`);
    }
  }

  for (const hunk of diff.hunks) {
    if (!counted.has(hunk.id)) {
      wrong(`leaves ${hunk.id} out`);
    }
  }

  for (const hunk of counted.keys()) {
    if (!diff.hunks.some((each) => each.id === hunk)) {
      wrong(`assigns ${hunk}, which the diff does not contain`);
    }
  }
};

interface Drafting {
  readonly modelProposal?: readonly DraftedCohort[];
  readonly previous?: ChangeStack | null;
}

export class ChangeStack
  extends EventRecorder
  implements HasPendingJob<ChangeStack>
{
  private constructor(
    readonly id: ChangeStackId,
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly teamId: TeamId | null,
    readonly trial: boolean,
    readonly workspaceId: WorkspaceId,
    readonly repository: RepositoryName | null,
    readonly base: CommitSha | null,
    readonly diff: Diff,
    readonly facts: StackFacts,
    readonly cohorts: readonly StackCohort[],
    readonly progress: StackProgress,
    readonly job: PendingJob,
    readonly request: CheckRequest | null,
    readonly redrafting: boolean,
    readonly usage: ModelUsage,
    readonly previous: ChangeStackId | null,
    readonly removed: readonly RemovedLayer[],
    readonly version: number,
  ) {
    super();
  }

  static startGeneration(input: {
    id: ChangeStackId;
    runId: RunId;
    taskId: TaskId | null;
    teamOfRun: TeamId | null;
    trial: boolean;
    checkouts: number;
    workspaceId: WorkspaceId;
    repository: string | null;
    base: string | null;
    diff: Diff;
    facts: StackFacts;
    request: CheckRequest | null;
    taskStacks?: readonly ChangeStack[];
    now: Date;
  }): ChangeStack {
    if (input.checkouts === 0) {
      throw new NoStackWithoutCheckoutsError();
    }

    const owner = {
      taskId: input.taskId,
      teamId: input.taskId ? null : input.teamOfRun,
      trial: input.trial,
    };
    if (!owner.taskId && !owner.teamId) {
      throw new NoStackOwnerError();
    }
    assertOneOwner('change stack', owner);

    const repository = input.repository?.trim()
      ? RepositoryName.of(input.repository)
      : null;
    const previous = PreviousStack.chosenFrom(input.taskStacks ?? [], {
      id: input.id,
      taskId: owner.taskId,
      repository,
    });

    return new ChangeStack(
      input.id,
      input.runId,
      owner.taskId,
      owner.teamId,
      input.trial,
      input.workspaceId,
      repository,
      input.base?.trim() ? baseOf(input.base) : null,
      input.diff,
      input.facts,
      [],
      StackProgress.generating(input.now),
      PendingJob.fresh(),
      input.request,
      false,
      ModelUsage.none(),
      previous?.id ?? null,
      [],
      0,
    );
  }

  static rehydrate(input: {
    id: ChangeStackId;
    runId: RunId;
    taskId: TaskId | null;
    teamId: TeamId | null;
    trial: boolean;
    workspaceId: WorkspaceId;
    repository: RepositoryName | null;
    base: CommitSha | null;
    diff: Diff;
    facts: StackFacts;
    cohorts: readonly StackCohort[];
    progress: StackProgress;
    job: PendingJob;
    request: CheckRequest | null;
    redrafting: boolean;
    usage: ModelUsage;
    previous: ChangeStackId | null;
    removed: readonly RemovedLayer[];
    version: number;
  }): ChangeStack {
    assertComplete(input.progress, input.diff, input.cohorts);
    assertOneOwner('change stack', input);
    assertRevisedOnlyWithPrevious(input);

    return new ChangeStack(
      input.id,
      input.runId,
      input.taskId,
      input.teamId,
      input.trial,
      input.workspaceId,
      input.repository,
      input.base,
      input.diff,
      input.facts,
      input.cohorts,
      input.progress,
      input.job,
      input.request,
      input.redrafting,
      input.usage,
      input.previous,
      input.removed,
      input.version,
    );
  }

  get state(): ChangeStackState {
    return this.progress.state;
  }

  get failure(): StackFailure | null {
    return this.progress.failure;
  }

  get startedAt(): Date {
    return this.progress.startedAt;
  }

  get completedAt(): Date | null {
    return this.progress.completedAt;
  }

  get needsModel(): boolean {
    return placedHunks(this.facts).length > 0;
  }

  get hasPendingJob(): boolean {
    return this.state === 'generating' || this.redrafting;
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

  question(id: QuestionId): LayerQuestion {
    const found =
      this.state === 'ready'
        ? this.cohorts
            .flatMap((cohort) => cohort.layers)
            .flatMap((layer) => layer.questions)
            .find((each) => each.id === id)
        : undefined;

    if (!found) {
      throw new UnknownQuestionError();
    }

    return found;
  }

  citedBy(question: LayerQuestion): CitedHunk[] {
    return question.hunks.flatMap((id) => {
      const file = this.diff.fileOf(id);
      const hunk = file?.hunks.find((each) => each.id === id);

      return file && hunk ? [{ path: file.path, patch: hunk.patch }] : [];
    });
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
    return call ? this.with({ usage: this.usage.with(call) }) : this;
  }

  requestRedraft(): ChangeStack {
    return this.state === 'ready' && !this.redrafting
      ? this.with({ redrafting: true, job: PendingJob.fresh() })
      : this;
  }

  leaseJob(now: Date): ChangeStack {
    if (!this.hasPendingJob) {
      throw InvalidChangeStackError.because(
        'has nothing to generate or redraft',
      );
    }
    if (!this.job.isDue(now) || this.job.exhausted) {
      throw InvalidChangeStackError.because(
        'cannot be generated or redrafted again yet',
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
    return this.stopWith('not-generated', now);
  }

  renewJobLease(now: Date): ChangeStack {
    if (!this.hasPendingJob) {
      throw InvalidChangeStackError.because(
        'has nothing to generate or redraft',
      );
    }

    return this.with({ job: this.job.renewLease(now) });
  }

  settleFailedCall(
    failure: { readonly truncated: boolean },
    now: Date,
  ): ChangeStack {
    return failure.truncated
      ? this.stopWith('too-large', now)
      : this.scheduleRetry(now);
  }

  stopForBrokenRules(now: Date): ChangeStack {
    return this.stopWith('broke-rules', now);
  }

  redraftFor(check: StackCheck | null): RedraftRequest | null {
    return this.redrafting && check ? redraftRequestOf(this, check) : null;
  }

  private stopWith(failure: StackFailure, now: Date): ChangeStack {
    return this.state === 'generating'
      ? this.fail(failure, now)
      : this.stopRedrafting();
  }

  redrafted(
    cohorts: readonly DraftedCohort[],
    now: Date,
    options: Drafting = {},
  ): ChangeStack {
    if (!this.redrafting) {
      throw InvalidChangeStackError.because('is not being redrafted');
    }

    const previous = this.previousStack(options.previous);
    const ready = StackProposal.accepted({
      diff: this.diff,
      facts: this.facts,
      cohorts: this.arranged(cohorts),
      modelProposal:
        options.modelProposal && this.arranged(options.modelProposal),
      changeLayersAtLeast: changeLayerCount(this.cohorts),
      previous,
    });

    const redrafted = this.with({
      cohorts: ready,
      removed: previous ? PreviousStack.removedFrom(previous, ready) : [],
      progress: this.progress.complete('ready', now),
      job: PendingJob.fresh(),
      redrafting: false,
    });

    redrafted.record(new ChangeStackRedrafted(this.id, this.runId));
    redrafted.recordReady(now);
    return redrafted;
  }

  stopRedrafting(): ChangeStack {
    if (!this.redrafting) {
      return this;
    }

    const ended = this.with({ redrafting: false, job: PendingJob.fresh() });
    ended.record(new ChangeStackRedraftingEnded(this.id, this.runId));
    return ended;
  }

  propose(
    cohorts: readonly DraftedCohort[],
    now: Date,
    options: Drafting = {},
  ): ChangeStack {
    this.assertGenerating();

    const previous = this.previousStack(options.previous);
    const ready = StackProposal.accepted({
      diff: this.diff,
      facts: this.facts,
      cohorts: this.arranged(cohorts),
      modelProposal:
        options.modelProposal && this.arranged(options.modelProposal),
      previous,
    });

    const completed = this.with({
      cohorts: ready,
      removed: previous ? PreviousStack.removedFrom(previous, ready) : [],
      progress: this.progress.complete('ready', now),
      job: PendingJob.fresh(),
    });

    completed.record(new ChangeStackCompleted(this.id, this.runId, this.trial));
    completed.recordReady(now);
    completed.recordTrialSettled();
    return completed;
  }

  previousStack(
    previous: ChangeStack | null | undefined,
  ): PreviousStack | null {
    if (!this.previous) {
      if (previous) {
        throw InvalidChangeStackError.because('follows no previous stack');
      }
      return null;
    }
    if (previous === undefined) {
      throw InvalidChangeStackError.because(
        'must be drafted with the stack it follows, or be told it is gone',
      );
    }
    if (previous && !this.previous.equals(previous.id)) {
      throw InvalidChangeStackError.because(
        'can be revised only against the stack it follows',
      );
    }

    return previous ? PreviousStack.of(previous, this) : null;
  }

  reusedFrom(previous: ChangeStack, now: Date): ChangeStack | null {
    this.assertGenerating();
    const basis = this.previousStack(previous);

    if (!basis?.diffUnchanged) {
      return null;
    }

    try {
      return this.propose(PreviousStack.reusedCohorts(basis), now, {
        previous,
      });
    } catch (error) {
      if (error instanceof InvalidChangeStackError) {
        return null;
      }
      throw error;
    }
  }

  private arranged(cohorts: readonly DraftedCohort[]): ProposedCohort[] {
    return arranged(this.diff, this.facts, DraftedStack.cohorts(cohorts));
  }

  private recordTrialSettled(): void {
    if (this.trial) {
      this.record(new TrialStackSettled(this.id, this.runId, this.workspaceId));
    }
  }

  private recordReady(at: Date): void {
    if (!actsOutsideSpotlight(this)) {
      return;
    }

    this.record(
      new ChangeStackBecameReady(
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

  private fail(failure: StackFailure, now: Date): ChangeStack {
    this.assertGenerating();

    const failed = this.with({
      progress: this.progress.complete('failed', now, { failure }),
      job: PendingJob.fresh(),
    });

    failed.recordTrialSettled();

    return failed;
  }

  private assertGenerating(): void {
    if (this.state !== 'generating') {
      throw InvalidChangeStackError.because(`is already ${this.state}`);
    }
  }

  private with(change: {
    cohorts?: readonly StackCohort[];
    progress?: StackProgress;
    job?: PendingJob;
    redrafting?: boolean;
    usage?: ModelUsage;
    removed?: readonly RemovedLayer[];
  }): ChangeStack {
    const next = new ChangeStack(
      this.id,
      this.runId,
      this.taskId,
      this.teamId,
      this.trial,
      this.workspaceId,
      this.repository,
      this.base,
      this.diff,
      this.facts,
      change.cohorts ?? this.cohorts,
      change.progress ?? this.progress,
      change.job ?? this.job,
      this.request,
      change.redrafting ?? this.redrafting,
      change.usage ?? this.usage,
      this.previous,
      change.removed ?? this.removed,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
