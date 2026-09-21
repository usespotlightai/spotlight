import { ChangeStackDraftingBegan } from '@change-review/domain/events/change-stack-drafting-began.event';
import { ChangeStackFailed } from '@change-review/domain/events/change-stack-failed.event';
import { ChangeStackReordered } from '@change-review/domain/events/change-stack-reordered.event';
import { ChangeStackReorderingEnded } from '@change-review/domain/events/change-stack-reordering-ended.event';
import { ChangeStackSettled } from '@change-review/domain/events/change-stack-settled.event';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { arranged } from '@change-review/domain/services/arrange-stack';
import { checkStepsOf } from '@change-review/domain/services/check-steps';
import { generatedEntries } from '@change-review/domain/services/generated-entries';
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
import { StackWork } from '@change-review/domain/value-objects/stack-work.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const NOT_DRAFTED = 'The change stack could not be drafted.';

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
  const wrong = (says: string): never => {
    throw new InconsistentStateError('change stack', says);
  };

  if (progress.state === 'drafting' && cohorts.length > 0) {
    wrong('is still drafting, yet already holds cohorts');
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
      wrong(`places ${hunk}, which the diff does not hold`);
    }
  }
};

export class ChangeStack extends EventRecorder {
  private constructor(
    readonly id: ChangeStackId,
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly workspaceId: WorkspaceId,
    readonly repository: RepositoryName | null,
    readonly base: BaseCommit | null,
    readonly diff: Diff,
    readonly facts: StackFacts,
    readonly cohorts: readonly StackCohort[],
    readonly progress: StackProgress,
    readonly work: StackWork,
    readonly request: CheckRequest | null,
    readonly reordering: boolean,
    readonly version: number,
  ) {
    super();
  }

  static draft(input: {
    id: ChangeStackId;
    runId: RunId;
    taskId: TaskId | null;
    workspaceId: WorkspaceId;
    repository: string | null;
    base: string | null;
    diff: Diff;
    facts: StackFacts;
    request: CheckRequest | null;
    now: Date;
  }): ChangeStack {
    const stack = new ChangeStack(
      input.id,
      input.runId,
      input.taskId,
      input.workspaceId,
      input.repository?.trim() ? RepositoryName.of(input.repository) : null,
      input.base?.trim() ? BaseCommit.of(input.base) : null,
      input.diff,
      input.facts,
      [],
      StackProgress.drafting(input.now),
      StackWork.fresh(),
      input.request,
      false,
      0,
    );

    stack.record(new ChangeStackDraftingBegan(stack.id, stack.runId));

    return stack;
  }

  static rehydrate(input: {
    id: ChangeStackId;
    runId: RunId;
    taskId: TaskId | null;
    workspaceId: WorkspaceId;
    repository: RepositoryName | null;
    base: BaseCommit | null;
    diff: Diff;
    facts: StackFacts;
    cohorts: readonly StackCohort[];
    progress: StackProgress;
    work: StackWork;
    request: CheckRequest | null;
    reordering: boolean;
    version: number;
  }): ChangeStack {
    assertWhole(input.progress, input.diff, input.cohorts);

    return new ChangeStack(
      input.id,
      input.runId,
      input.taskId,
      input.workspaceId,
      input.repository,
      input.base,
      input.diff,
      input.facts,
      input.cohorts,
      input.progress,
      input.work,
      input.request,
      input.reordering,
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

  get settledAt(): Date | null {
    return this.progress.settledAt;
  }

  get owesWork(): boolean {
    return this.state === 'drafting' || this.reordering;
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

  askedToReorder(): ChangeStack {
    return this.state === 'ready' && !this.reordering
      ? this.with({ reordering: true, work: StackWork.fresh() })
      : this;
  }

  leased(now: Date): ChangeStack {
    if (!this.owesWork) {
      throw InvalidChangeStackError.because('has nothing to draft or reorder');
    }
    if (!this.work.dueBy(now) || this.work.exhausted) {
      throw InvalidChangeStackError.because('cannot be worked on again yet');
    }

    return this.with({ work: this.work.leased(now) });
  }

  triedAgainLater(now: Date): ChangeStack {
    if (!this.owesWork) {
      return this;
    }

    return this.work.exhausted
      ? this.gaveUp(now)
      : this.with({ work: this.work.backedOff(now) });
  }

  gaveUp(now: Date): ChangeStack {
    if (this.state === 'drafting') {
      return this.fail(NOT_DRAFTED, now);
    }

    return this.gaveUpReordering();
  }

  reordered(cohorts: readonly ProposedCohort[], now: Date): ChangeStack {
    if (!this.reordering) {
      throw InvalidChangeStackError.because('is not being reordered');
    }

    const setAside = arranged(this.diff, this.facts, cohorts);
    const before = changeLayers(this.cohorts);
    const after = changeLayers(setAside);

    const ready = StackProposal.settle({
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
      progress: this.progress.settled('ready', now),
      work: StackWork.fresh(),
      reordering: false,
    });

    reordered.record(new ChangeStackReordered(this.id, this.runId));
    return reordered;
  }

  gaveUpReordering(): ChangeStack {
    if (!this.reordering) {
      return this;
    }

    const kept = this.with({ reordering: false, work: StackWork.fresh() });
    kept.record(new ChangeStackReorderingEnded(this.id, this.runId));
    return kept;
  }

  propose(cohorts: readonly ProposedCohort[], now: Date): ChangeStack {
    this.assertDrafting();

    const ready = StackProposal.settle({
      diff: this.diff,
      facts: this.facts,
      cohorts: arranged(this.diff, this.facts, cohorts),
    });

    const settledStack = this.with({
      cohorts: ready,
      progress: this.progress.settled('ready', now),
      work: StackWork.fresh(),
    });

    settledStack.record(new ChangeStackSettled(this.id, this.runId));
    return settledStack;
  }

  fail(reason: string, now: Date): ChangeStack {
    this.assertDrafting();

    const failure = reason.trim() || INTERRUPTED;

    const failed = this.with({
      progress: this.progress.settled('failed', now, { failure }),
      work: StackWork.fresh(),
    });

    failed.record(new ChangeStackFailed(this.id, this.runId, failure));

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
    work?: StackWork;
    reordering?: boolean;
  }): ChangeStack {
    const next = new ChangeStack(
      this.id,
      this.runId,
      this.taskId,
      this.workspaceId,
      this.repository,
      this.base,
      this.diff,
      this.facts,
      change.cohorts ?? this.cohorts,
      change.progress ?? this.progress,
      change.work ?? this.work,
      this.request,
      change.reordering ?? this.reordering,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
