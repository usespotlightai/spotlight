import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { ChangeStackDraftingBegan } from '@change-review/domain/events/change-stack-drafting-began.event';
import { ChangeStackSettled } from '@change-review/domain/events/change-stack-settled.event';
import { LayersFailedCheck } from '@change-review/domain/events/layers-failed-check.event';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { checkStepsOf } from '@change-review/domain/services/check-steps';
import { generatedEntries } from '@change-review/domain/services/generated-entries';
import { StackProposal } from '@change-review/domain/services/stack-proposal';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import {
  type CheckedStep,
  type CheckStep,
  StackCheck,
  type StackCheckState,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import type {
  ProposedCohort,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import {
  type ChangeStackState,
  INTERRUPTED,
  StackProgress,
  UNCHECKED,
} from '@change-review/domain/value-objects/stack-progress.vo';
import { StackWork } from '@change-review/domain/value-objects/stack-work.vo';
import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MOST_CHECK_OUTPUT = 16_000;

const NOT_DRAFTED = 'The change stack could not be drafted.';

const WHOLE_FAILED =
  'The finished change does not pass the check, so its layers were not checked on their own.';

const changeLayers = (
  stack: readonly { kind: string; layers: readonly unknown[] }[],
): number =>
  stack
    .filter((cohort) => cohort.kind === 'change')
    .reduce((total, cohort) => total + cohort.layers.length, 0);

export class ChangeStack extends EventRecorder {
  private constructor(
    readonly id: ChangeStackId,
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly workspaceId: WorkspaceId,
    readonly repository: string | null,
    readonly diff: Diff,
    readonly facts: StackFacts,
    readonly cohorts: readonly StackCohort[],
    readonly progress: StackProgress,
    readonly work: StackWork,
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
    diff: Diff;
    facts: StackFacts;
    check?: string | null;
    now: Date;
  }): ChangeStack {
    const stack = new ChangeStack(
      input.id,
      input.runId,
      input.taskId,
      input.workspaceId,
      input.repository?.trim() || null,
      input.diff,
      input.facts,
      [],
      StackProgress.drafting(
        input.now,
        input.check?.trim() ? StackCheck.named(input.check) : null,
      ),
      StackWork.fresh(),
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
    repository: string | null;
    diff: Diff;
    facts: StackFacts;
    cohorts: readonly StackCohort[];
    progress: StackProgress;
    work: StackWork;
    version: number;
  }): ChangeStack {
    return new ChangeStack(
      input.id,
      input.runId,
      input.taskId,
      input.workspaceId,
      input.repository,
      input.diff,
      input.facts,
      input.cohorts,
      input.progress,
      input.work,
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

  get check(): StackCheck | null {
    return this.progress.check;
  }

  checkStateAt(now: Date): StackCheckState | null {
    return this.progress.checkStateAt(now);
  }

  checkReasonAt(now: Date): string | null {
    return this.progress.checkReasonAt(now);
  }

  get owesWork(): boolean {
    return this.state === 'drafting' || this.check?.reordering === true;
  }

  checkSteps(): CheckStep[] {
    return checkStepsOf({
      hunks: this.diff.hunks.map((hunk) => hunk.id),
      facts: this.facts,
      cohorts: this.cohorts,
      entries: this.check?.entries ?? [],
    });
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

    return this.keepLayers();
  }

  failedLayers(): readonly string[] {
    const outcome = this.check?.outcome;

    return outcome?.state === 'checked'
      ? outcome.layers
          .filter((checked) => !checked.passed)
          .map((checked) => checked.step)
      : [];
  }

  recordCheck(steps: readonly CheckedStep[], now: Date): ChangeStack {
    const check = this.assertCheckable(now);
    const planned = this.checkSteps();
    const known = new Set(planned.map((step) => step.id));
    const problems = steps
      .filter((step) => !known.has(step.step))
      .map((step) => `checks ${step.step}, which is not a step of this stack`);
    const whole = steps.find((step) => step.step === WHOLE_STEP);

    if (!whole) {
      problems.push('checks nothing without checking the whole change');
    }
    if (problems.length > 0 || !whole) {
      throw InvalidChangeStackError.because(...problems);
    }

    const trimmed = (step: CheckedStep): CheckedStep => ({
      ...step,
      output: step.output.slice(-MOST_CHECK_OUTPUT),
      tookMs: Math.max(0, Math.round(step.tookMs)),
    });
    const given = new Map(steps.map((step) => [step.step, trimmed(step)]));
    const layers = whole.passed
      ? this.cohorts
          .filter((cohort) => cohort.kind === 'change')
          .flatMap((cohort) => cohort.layers)
          .flatMap((layer): CheckedStep[] => {
            const result = known.has(layer.id)
              ? given.get(layer.id)
              : given.get(WHOLE_STEP);
            return result ? [{ ...result, step: layer.id }] : [];
          })
      : [];

    const found = check.found({
      state: 'checked',
      reason: whole.passed ? null : WHOLE_FAILED,
      whole: trimmed(whole),
      layers,
      checkedAt: now,
    });
    const checked = this.with({
      progress: this.progress.checked(found),
      work: StackWork.fresh(),
    });

    checked.record(
      found.reordering
        ? new LayersFailedCheck(this.id, this.runId)
        : new ChangeStackChecked(this.id, this.runId),
    );
    return checked;
  }

  skipCheck(reason: string, now: Date): ChangeStack {
    const check = this.assertCheckable(now);

    const skipped = this.with({
      progress: this.progress.checked(
        check.found({
          state: 'skipped',
          reason: reason.trim().slice(0, 500) || UNCHECKED,
          whole: null,
          layers: [],
          checkedAt: now,
        }),
      ),
    });

    skipped.record(new ChangeStackChecked(this.id, this.runId));
    return skipped;
  }

  reordered(
    cohorts: readonly ProposedCohort[],
    now: Date,
    strict: boolean,
  ): ChangeStack {
    const check = this.check;

    if (!check?.reordering || this.checkStateAt(now) !== 'waiting') {
      throw InvalidChangeStackError.because('is not being reordered');
    }

    const before = changeLayers(this.cohorts);
    const after = changeLayers(cohorts);

    const ready = StackProposal.settle({
      diff: this.diff,
      facts: this.facts,
      cohorts,
      strict,
      also:
        strict && after < before
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
      progress: this.progress.settled('ready', now, {
        check: check.reordered(generatedEntries(this.diff, ready, this.facts)),
      }),
      work: StackWork.fresh(),
    });

    reordered.record(new ChangeStackSettled(this.id, this.runId));
    return reordered;
  }

  keepLayers(): ChangeStack {
    if (!this.check?.reordering) {
      return this;
    }

    const kept = this.with({
      progress: this.progress.checked(this.check.keptLayers()),
      work: StackWork.fresh(),
    });
    kept.record(new ChangeStackChecked(this.id, this.runId));
    return kept;
  }

  propose(
    cohorts: readonly ProposedCohort[],
    now: Date,
    strict = true,
  ): ChangeStack {
    this.assertDrafting();

    const ready = StackProposal.settle({
      diff: this.diff,
      facts: this.facts,
      cohorts,
      strict,
    });

    const settledStack = this.with({
      cohorts: ready,
      progress: this.progress.settled('ready', now, {
        check:
          this.check?.planned(generatedEntries(this.diff, ready, this.facts)) ??
          null,
      }),
      work: StackWork.fresh(),
    });

    settledStack.record(new ChangeStackSettled(this.id, this.runId));
    return settledStack;
  }

  fail(reason: string, now: Date): ChangeStack {
    this.assertDrafting();

    return this.with({
      progress: this.progress.settled('failed', now, {
        failure: reason.trim() || INTERRUPTED,
      }),
      work: StackWork.fresh(),
    });
  }

  private assertCheckable(now: Date): StackCheck {
    if (!this.check) {
      throw InvalidChangeStackError.because('was not given a check to run');
    }
    if (!this.check.waiting || this.checkStateAt(now) !== 'waiting') {
      throw InvalidChangeStackError.because(
        `cannot be checked while its check is ${this.checkStateAt(now) ?? this.state}`,
      );
    }

    return this.check;
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
  }): ChangeStack {
    const next = new ChangeStack(
      this.id,
      this.runId,
      this.taskId,
      this.workspaceId,
      this.repository,
      this.diff,
      this.facts,
      change.cohorts ?? this.cohorts,
      change.progress ?? this.progress,
      change.work ?? this.work,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
