import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { LayersFailedCheck } from '@change-review/domain/events/layers-failed-check.event';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckClaim } from '@change-review/domain/value-objects/check-claim.vo';
import type { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import type {
  CheckEntry,
  CheckedStep,
  CheckOutcome,
  CheckPhase,
  CheckStep,
  StackCheckState,
  StackSkip,
} from '@change-review/domain/value-objects/stack-check.vo';
import {
  nobodyChecked,
  unprovisioned,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import type { LayerId } from '@change-review/domain/value-objects/stack-ids';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MOST_CHECK_OUTPUT = 16_000;

const MOST_REORDERINGS = 1;

export const WAITING_LIMIT_MS = 60 * 60 * 1000;

const OUTCOME_OF: Readonly<Record<CheckPhase, CheckOutcome['state'] | null>> = {
  waiting: null,
  reordering: 'checked',
  checked: 'checked',
  skipped: 'skipped',
};

export interface PlannedCheck {
  readonly steps: readonly CheckStep[];
  readonly layers: readonly LayerId[];
}

export class StackCheck extends EventRecorder {
  private constructor(
    readonly stackId: ChangeStackId,
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly request: CheckRequest,
    readonly phase: CheckPhase,
    readonly entries: readonly CheckEntry[],
    readonly rounds: number,
    readonly outcome: CheckOutcome | null,
    readonly claim: CheckClaim,
    readonly waitingSince: Date,
    readonly reservation: RunnerReservation | null,
    readonly provisioning: Provisioning,
    readonly version: number,
  ) {
    super();
  }

  static begin(input: {
    stackId: ChangeStackId;
    runId: RunId;
    workspaceId: WorkspaceId;
    request: CheckRequest;
    entries: readonly CheckEntry[];
    now: Date;
  }): StackCheck {
    return new StackCheck(
      input.stackId,
      input.runId,
      input.workspaceId,
      input.request,
      'waiting',
      input.entries,
      0,
      null,
      CheckClaim.none(),
      input.now,
      null,
      Provisioning.none(),
      0,
    );
  }

  static rehydrate(input: {
    stackId: ChangeStackId;
    runId: RunId;
    workspaceId: WorkspaceId;
    request: CheckRequest;
    phase: CheckPhase;
    entries: readonly CheckEntry[];
    rounds: number;
    outcome: CheckOutcome | null;
    claim: CheckClaim;
    waitingSince: Date;
    reservation: RunnerReservation | null;
    provisioning: Provisioning;
    version: number;
  }): StackCheck {
    const found = input.outcome?.state ?? null;

    if (found !== OUTCOME_OF[input.phase]) {
      throw new InconsistentStateError(
        'change stack check',
        `is ${input.phase} with ${found ? `a ${found} outcome` : 'no outcome'}`,
      );
    }
    if (!Number.isInteger(input.rounds) || input.rounds < 0) {
      throw new InconsistentStateError(
        'change stack check',
        `has been reordered ${input.rounds} times`,
      );
    }

    return new StackCheck(
      input.stackId,
      input.runId,
      input.workspaceId,
      input.request,
      input.phase,
      input.entries,
      input.rounds,
      input.outcome,
      input.claim,
      input.waitingSince,
      input.reservation,
      input.provisioning,
      input.version,
    );
  }

  get reordering(): boolean {
    return this.phase === 'reordering';
  }

  stateAt(now: Date): StackCheckState {
    const lapsed =
      now.getTime() - this.waitingSince.getTime() > WAITING_LIMIT_MS;

    switch (this.phase) {
      case 'waiting':
        return lapsed ? 'skipped' : 'waiting';
      case 'reordering':
        return 'waiting';
      default:
        return this.phase;
    }
  }

  skippedAt(now: Date): StackSkip | null {
    return this.stateAt(now) === 'skipped'
      ? (this.outcome?.skip ?? nobodyChecked())
      : null;
  }

  get wholeFailed(): boolean {
    return (
      this.outcome?.state === 'checked' && this.outcome.whole?.passed === false
    );
  }

  failedLayers(): readonly string[] {
    return this.outcome?.state === 'checked'
      ? this.outcome.layers
          .filter((checked) => !checked.passed)
          .map((checked) => checked.step)
      : [];
  }

  claimableAt(now: Date, by: RunnerId | null = null): boolean {
    return (
      this.phase === 'waiting' &&
      this.stateAt(now) === 'waiting' &&
      !this.claim.heldAt(now) &&
      !this.claim.exhausted &&
      (!this.isReservedAt(now) ||
        (by !== null && (this.reservation?.heldFor(by) ?? false)))
    );
  }

  claimedFor(runner: RunnerId, now: Date): StackCheck {
    if (!this.claimableAt(now, runner)) {
      throw InvalidChangeStackError.because(
        'has no check waiting for a runner to take up',
      );
    }

    return this.with({
      claim: this.claim.claimed(runner, now),
      reservation: null,
    });
  }

  isReservedAt(now: Date): boolean {
    return this.reservation?.holdsAt(now) ?? false;
  }

  reservationLapsedAt(now: Date): boolean {
    return (
      this.phase === 'waiting' &&
      this.reservation !== null &&
      !this.reservation.holdsAt(now)
    );
  }

  provisionableAt(now: Date): boolean {
    return (
      this.claimableAt(now) &&
      this.reservation === null &&
      this.provisioning.dueAt(now)
    );
  }

  reservedFor(runner: RunnerId, pool: string, now: Date): StackCheck {
    if (!this.provisionableAt(now)) {
      throw InvalidChangeStackError.because(
        'cannot be reserved for a runner to be provisioned while it is not waiting for one',
      );
    }

    return this.with({
      reservation: RunnerReservation.from(runner, pool, now),
    });
  }

  unreservedFor(runner: RunnerId): StackCheck {
    return this.reservation?.heldFor(runner)
      ? this.with({ reservation: null })
      : this;
  }

  provisionFailed(
    runner: RunnerId,
    failure: ProvisionFailure,
    now: Date,
  ): StackCheck {
    if (!this.reservation?.heldFor(runner) || this.claim.heldAt(now)) {
      return this;
    }

    if (this.phase !== 'waiting' || this.stateAt(now) !== 'waiting') {
      return this.unreservedFor(runner);
    }

    const provisioning = this.provisioning.failedAt(failure, now);

    if (!provisioning.exhausted) {
      return this.with({ reservation: null, provisioning });
    }

    return this.with({ reservation: null, provisioning }).found(
      {
        state: 'skipped',
        skip: unprovisioned(failure, provisioning.failures),
        whole: null,
        layers: [],
        checkedAt: now,
      },
      now,
    );
  }

  overdueAt(now: Date): boolean {
    return (
      this.phase === 'waiting' &&
      this.stateAt(now) === 'skipped' &&
      !this.claim.heldAt(now)
    );
  }

  settledOverdue(now: Date): StackCheck {
    if (!this.overdueAt(now)) {
      throw InvalidChangeStackError.because(
        'is not overdue, so nobody failed to check it yet',
      );
    }

    return this.with({ reservation: null }).found(
      {
        state: 'skipped',
        skip: nobodyChecked(),
        whole: null,
        layers: [],
        checkedAt: now,
      },
      now,
    );
  }

  renewedFor(runner: RunnerId, now: Date): StackCheck {
    if (!this.claim.heldBy(runner, now)) {
      throw InvalidChangeStackError.because(
        'is not being checked by that runner',
      );
    }

    return this.with({ claim: this.claim.renewed(now) });
  }

  recorded(
    planned: PlannedCheck,
    steps: readonly CheckedStep[],
    now: Date,
  ): StackCheck {
    this.assertCheckable(now);

    const known = new Set(planned.steps.map((step) => step.id));
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
      ? planned.layers.flatMap((layer): CheckedStep[] => {
          const result = known.has(layer)
            ? given.get(layer)
            : given.get(WHOLE_STEP);
          return result ? [{ ...result, step: layer }] : [];
        })
      : [];

    return this.found(
      {
        state: 'checked',
        skip: null,
        whole: trimmed(whole),
        layers,
        checkedAt: now,
      },
      now,
    );
  }

  skipped(skip: StackSkip, now: Date): StackCheck {
    this.assertCheckable(now);

    return this.found(
      { state: 'skipped', skip, whole: null, layers: [], checkedAt: now },
      now,
    );
  }

  reordered(entries: readonly CheckEntry[], now: Date): StackCheck {
    this.assertIn('reordering', 'take reordered layers');

    return this.with({
      phase: 'waiting',
      entries,
      rounds: this.rounds + 1,
      outcome: null,
      waitingSince: now,
      claim: this.claim.released(),
      reservation: null,
      provisioning: Provisioning.none(),
    });
  }

  keptLayers(): StackCheck {
    this.assertIn('reordering', 'keep its layers');

    const kept = this.with({ phase: 'checked' });
    kept.record(new ChangeStackChecked(this.stackId, this.runId));

    return kept;
  }

  private found(outcome: CheckOutcome, now: Date): StackCheck {
    const reorder =
      outcome.state === 'checked' &&
      outcome.whole?.passed === true &&
      outcome.layers.some((layer) => !layer.passed) &&
      this.rounds < MOST_REORDERINGS;

    const found = this.with({
      phase: reorder ? 'reordering' : outcome.state,
      outcome,
      claim: this.claim.released(),
      waitingSince: now,
    });

    found.record(
      reorder
        ? new LayersFailedCheck(this.stackId, this.runId)
        : new ChangeStackChecked(this.stackId, this.runId),
    );

    return found;
  }

  private assertCheckable(now: Date): void {
    if (this.stateAt(now) !== 'waiting' || this.phase !== 'waiting') {
      throw InvalidChangeStackError.because(
        `cannot take what a check found while it is ${this.stateAt(now)}`,
      );
    }
  }

  private assertIn(phase: CheckPhase, to: string): void {
    if (this.phase !== phase) {
      throw InvalidChangeStackError.because(
        `cannot ${to} while its check is ${this.phase}`,
      );
    }
  }

  private with(change: {
    phase?: CheckPhase;
    entries?: readonly CheckEntry[];
    rounds?: number;
    outcome?: CheckOutcome | null;
    claim?: CheckClaim;
    waitingSince?: Date;
    reservation?: RunnerReservation | null;
    provisioning?: Provisioning;
  }): StackCheck {
    const next = new StackCheck(
      this.stackId,
      this.runId,
      this.workspaceId,
      this.request,
      change.phase ?? this.phase,
      change.entries ?? this.entries,
      change.rounds ?? this.rounds,
      change.outcome !== undefined ? change.outcome : this.outcome,
      change.claim ?? this.claim,
      change.waitingSince ?? this.waitingSince,
      change.reservation !== undefined ? change.reservation : this.reservation,
      change.provisioning ?? this.provisioning,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
