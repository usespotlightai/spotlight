import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { CheckReservationDropped } from '@change-review/domain/events/check-reservation-dropped.event';
import { LayersFailedCheck } from '@change-review/domain/events/layers-failed-check.event';
import { LeasedCheckDeleted } from '@change-review/domain/events/leased-check-deleted.event';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { StackCheckNotLeasedError } from '@change-review/domain/exceptions/stack-check-not-leased.error';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckClaim } from '@change-review/domain/value-objects/check-claim.vo';
import type { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import type {
  CheckEntry,
  CheckedStep,
  CheckOutcome,
  CheckStatusView,
  CheckStep,
  StackCheckStatus,
  StackSkip,
} from '@change-review/domain/value-objects/stack-check.vo';
import {
  checkStatusAt,
  provisionFailed,
  queueTimeout,
  WHOLE_STEP,
} from '@change-review/domain/value-objects/stack-check.vo';
import type { LayerId } from '@change-review/domain/value-objects/stack-ids';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MAX_CHECK_OUTPUT = 16_000;

const MAX_REDRAFTS = 1;

const OUTCOME_OF: Readonly<
  Record<StackCheckStatus, CheckOutcome['status'] | null>
> = {
  waiting: null,
  redrafting: 'checked',
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
    readonly taskId: TaskId | null,
    readonly replay: boolean,
    readonly recheck: boolean,
    readonly workspaceId: WorkspaceId,
    readonly request: CheckRequest,
    readonly status: StackCheckStatus,
    readonly entries: readonly CheckEntry[],
    readonly redraftCount: number,
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
    taskId: TaskId | null;
    replay: boolean;
    workspaceId: WorkspaceId;
    request: CheckRequest;
    entries: readonly CheckEntry[];
    now: Date;
  }): StackCheck {
    return new StackCheck(
      input.stackId,
      input.runId,
      input.taskId,
      input.replay,
      false,
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
    taskId: TaskId | null;
    replay: boolean;
    recheck: boolean;
    workspaceId: WorkspaceId;
    request: CheckRequest;
    status: StackCheckStatus;
    entries: readonly CheckEntry[];
    redraftCount: number;
    outcome: CheckOutcome | null;
    claim: CheckClaim;
    waitingSince: Date;
    reservation: RunnerReservation | null;
    provisioning: Provisioning;
    version: number;
  }): StackCheck {
    const stored = input.outcome?.status ?? null;

    if (stored !== OUTCOME_OF[input.status]) {
      throw new InconsistentStateError(
        'change stack check',
        `is ${input.status} with ${stored ? `a ${stored} outcome` : 'no outcome'}`,
      );
    }
    if (!Number.isInteger(input.redraftCount) || input.redraftCount < 0) {
      throw new InconsistentStateError(
        'change stack check',
        `has been redrafted ${input.redraftCount} times`,
      );
    }
    if (input.recheck && (!input.replay || input.redraftCount > 0)) {
      throw new InconsistentStateError(
        'change stack check',
        'is a recheck only of a replay’s change, and never redrafts it',
      );
    }

    return new StackCheck(
      input.stackId,
      input.runId,
      input.taskId,
      input.replay,
      input.recheck,
      input.workspaceId,
      input.request,
      input.status,
      input.entries,
      input.redraftCount,
      input.outcome,
      input.claim,
      input.waitingSince,
      input.reservation,
      input.provisioning,
      input.version,
    );
  }

  rechecking(now: Date): StackCheck {
    if (!this.replay || this.recheck || !this.hasWholeResult) {
      throw InvalidChangeStackError.because(
        'is checked again only once, as a replay’s change its first check passed or failed',
      );
    }

    return new StackCheck(
      this.stackId,
      this.runId,
      this.taskId,
      this.replay,
      true,
      this.workspaceId,
      this.request,
      'waiting',
      this.entries,
      0,
      null,
      CheckClaim.none(),
      now,
      null,
      Provisioning.none(),
      0,
    );
  }

  get hasWholeResult(): boolean {
    return this.status === 'checked' && Boolean(this.outcome?.whole);
  }

  get redrafting(): boolean {
    return this.status === 'redrafting';
  }

  statusAt(now: Date): CheckStatusView {
    return checkStatusAt(
      {
        status: this.status,
        waitingSince: this.waitingSince,
        lease: this.claim,
      },
      now,
    );
  }

  skippedAt(now: Date): StackSkip | null {
    return this.statusAt(now) === 'skipped'
      ? (this.outcome?.skip ?? queueTimeout())
      : null;
  }

  get wholeFailed(): boolean {
    return (
      this.outcome?.status === 'checked' && this.outcome.whole?.passed === false
    );
  }

  failedLayers(): readonly string[] {
    return this.outcome?.status === 'checked'
      ? this.outcome.layers
          .filter((checked) => !checked.passed)
          .map((checked) => checked.step)
      : [];
  }

  claimableAt(now: Date, by: RunnerId | null = null): boolean {
    return (
      this.status === 'waiting' &&
      this.statusAt(now) === 'waiting' &&
      !this.claim.isLeasedAt(now) &&
      !this.claim.exhausted &&
      (!this.isReservedAt(now) ||
        (by !== null && (this.reservation?.isFor(by) ?? false)))
    );
  }

  claimableBy(runner: RunnerId, terms: RunnerTerms, now: Date): boolean {
    return (
      this.claimableAt(now, runner) && this.request.placement.matches(terms)
    );
  }

  claimedFor(runner: RunnerId, terms: RunnerTerms, now: Date): StackCheck {
    if (!this.claimableAt(now, runner)) {
      throw InvalidChangeStackError.because(
        'has no check waiting for a runner to claim',
      );
    }
    if (!this.request.placement.matches(terms)) {
      throw InvalidChangeStackError.because(
        'is placed on runners that do not answer to these terms',
      );
    }

    const unreserved = this.reservation?.isFor(runner)
      ? this.with({ reservation: null })
      : this.droppingReservation();

    return unreserved.with({ claim: this.claim.claimed(runner, now) });
  }

  unclaimedBy(runner: RunnerId, now: Date): StackCheck {
    this.assertCheckedBy(runner, now);

    return this.with({ claim: this.claim.unclaimed() });
  }

  renewedFor(runner: RunnerId, now: Date): StackCheck {
    this.assertCheckable(now, 'keep being checked');
    this.assertCheckedBy(runner, now);

    return this.with({ claim: this.claim.renewed(now) });
  }

  beingCheckedBy(runner: RunnerId, now: Date): boolean {
    return this.claim.isLeasedBy(runner, now);
  }

  checkableAt(now: Date): boolean {
    return this.status === 'waiting' && this.statusAt(now) === 'waiting';
  }

  isReservedAt(now: Date): boolean {
    return this.reservation?.isActiveAt(now) ?? false;
  }

  reservationExpiredAt(now: Date): boolean {
    return (
      this.status === 'waiting' &&
      this.reservation !== null &&
      !this.reservation.isActiveAt(now)
    );
  }

  provisionableAt(now: Date): boolean {
    return (
      this.claimableAt(now) &&
      this.reservation === null &&
      this.provisioning.isDue(now)
    );
  }

  reservedFor(runner: RunnerId, pool: PoolId, now: Date): StackCheck {
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
    return this.reservation?.isFor(runner) ? this.droppingReservation() : this;
  }

  provisionFailed(
    runner: RunnerId,
    failure: ProvisionFailure,
    now: Date,
  ): StackCheck {
    if (!this.reservation?.isFor(runner) || this.claim.isLeasedAt(now)) {
      return this;
    }

    if (this.status !== 'waiting' || this.statusAt(now) !== 'waiting') {
      return this.unreservedFor(runner);
    }

    const provisioning = this.provisioning.recordFailure(failure, now);
    const failed = this.droppingReservation().with({ provisioning });

    if (!provisioning.exhausted) {
      return failed;
    }

    return failed.complete(
      {
        status: 'skipped',
        skip: provisionFailed(failure, provisioning.attempts),
        whole: null,
        layers: [],
        checkedAt: now,
      },
      now,
    );
  }

  waitExpiredAt(now: Date): boolean {
    return this.status === 'waiting' && this.statusAt(now) === 'skipped';
  }

  expireWait(now: Date): StackCheck {
    if (!this.waitExpiredAt(now)) {
      throw InvalidChangeStackError.because(
        'has not waited past its limit, so nobody failed to check it yet',
      );
    }

    return this.droppingReservation().complete(
      {
        status: 'skipped',
        skip: queueTimeout(),
        whole: null,
        layers: [],
        checkedAt: now,
      },
      now,
    );
  }

  delete(now: Date): StackCheck {
    const deleted = this.droppingReservation();

    if (!this.claim.isLeasedAt(now)) {
      return deleted;
    }

    const released = deleted.with({ claim: this.claim.released() });
    released.record(new LeasedCheckDeleted(this.stackId));

    return released;
  }

  recordResult(
    by: RunnerId,
    planned: PlannedCheck,
    steps: readonly CheckedStep[],
    now: Date,
  ): StackCheck {
    this.assertCheckable(now, 'take what a check found');
    this.assertCheckedBy(by, now);

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
      output: step.output.slice(-MAX_CHECK_OUTPUT),
      durationMs: Math.max(0, Math.round(step.durationMs)),
    });
    const reported = new Map(steps.map((step) => [step.step, trimmed(step)]));
    const layers = whole.passed
      ? planned.layers.flatMap((layer): CheckedStep[] => {
          const result = known.has(layer)
            ? reported.get(layer)
            : reported.get(WHOLE_STEP);
          return result ? [{ ...result, step: layer }] : [];
        })
      : [];

    return this.complete(
      {
        status: 'checked',
        skip: null,
        whole: trimmed(whole),
        layers,
        checkedAt: now,
      },
      now,
    );
  }

  skip(by: RunnerId, reason: StackSkip, now: Date): StackCheck {
    this.assertCheckable(now, 'take what a check found');
    this.assertCheckedBy(by, now);

    return this.complete(
      {
        status: 'skipped',
        skip: reason,
        whole: null,
        layers: [],
        checkedAt: now,
      },
      now,
    );
  }

  redrafted(entries: readonly CheckEntry[], now: Date): StackCheck {
    this.assertIn('redrafting', 'take redrafted layers');

    return this.droppingReservation().with({
      status: 'waiting',
      entries,
      redraftCount: this.redraftCount + 1,
      outcome: null,
      waitingSince: now,
      claim: this.claim.released(),
      provisioning: Provisioning.none(),
    });
  }

  retainCheckedLayers(): StackCheck {
    this.assertIn('redrafting', 'retain its layers');

    const checked = this.with({ status: 'checked' });
    checked.record(
      new ChangeStackChecked(
        this.stackId,
        this.runId,
        this.taskId,
        this.workspaceId,
        this.outcome?.whole?.passed ?? null,
        this.replay,
        this.recheck,
      ),
    );

    return checked;
  }

  private droppingReservation(): StackCheck {
    if (!this.reservation) {
      return this;
    }

    const dropped = this.with({ reservation: null });
    dropped.record(
      new CheckReservationDropped(this.stackId, this.reservation.runner),
    );

    return dropped;
  }

  private complete(outcome: CheckOutcome, now: Date): StackCheck {
    const redraft =
      outcome.status === 'checked' &&
      outcome.whole?.passed === true &&
      outcome.layers.some((layer) => !layer.passed) &&
      !this.recheck &&
      this.redraftCount < MAX_REDRAFTS;

    const completed = this.with({
      status: redraft ? 'redrafting' : outcome.status,
      outcome,
      claim: this.claim.released(),
      waitingSince: now,
    });

    completed.record(
      redraft
        ? new LayersFailedCheck(this.stackId, this.runId)
        : new ChangeStackChecked(
            this.stackId,
            this.runId,
            this.taskId,
            this.workspaceId,
            outcome.status === 'checked'
              ? (outcome.whole?.passed ?? null)
              : null,
            this.replay,
            this.recheck,
          ),
    );

    return completed;
  }

  private assertCheckable(now: Date, to: string): void {
    if (!this.checkableAt(now)) {
      throw InvalidChangeStackError.because(
        `cannot ${to} while it is ${this.statusAt(now)}`,
      );
    }
  }

  private assertCheckedBy(runner: RunnerId, now: Date): void {
    if (!this.beingCheckedBy(runner, now)) {
      throw new StackCheckNotLeasedError(this.stackId.value);
    }
  }

  private assertIn(status: StackCheckStatus, to: string): void {
    if (this.status !== status) {
      throw InvalidChangeStackError.because(
        `cannot ${to} while its check is ${this.status}`,
      );
    }
  }

  private with(change: {
    status?: StackCheckStatus;
    entries?: readonly CheckEntry[];
    redraftCount?: number;
    outcome?: CheckOutcome | null;
    claim?: CheckClaim;
    waitingSince?: Date;
    reservation?: RunnerReservation | null;
    provisioning?: Provisioning;
  }): StackCheck {
    const next = new StackCheck(
      this.stackId,
      this.runId,
      this.taskId,
      this.replay,
      this.recheck,
      this.workspaceId,
      this.request,
      change.status ?? this.status,
      change.entries ?? this.entries,
      change.redraftCount ?? this.redraftCount,
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
