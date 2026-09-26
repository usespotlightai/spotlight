import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import type { RunState } from '@work/domain/value-objects/run-state';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

const LEASE_DURATION_MS = 60_000;

const MAX_ATTEMPTS = 3;

export class Run extends EventRecorder {
  private constructor(
    readonly id: RunId,
    readonly workspaceId: WorkspaceId,
    readonly harness: HarnessId,
    readonly priority: RunPriority,
    readonly subject: RunSubject | null,
    readonly spec: RunSpec,
    readonly placement: RunnerPlacement,
    readonly state: RunState,
    readonly claimedBy: RunnerId | null,
    readonly leaseExpiresAt: Date | null,
    readonly outcome: RunOutcome | null,
    readonly attempt: number,
    readonly stopRequestedAt: Date | null,
    readonly reservation: RunnerReservation | null,
    readonly provisioning: Provisioning,
    readonly ranIn: RunnerImage | null,
    readonly version: number = 0,
  ) {
    super();
  }

  static enqueue(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority?: RunPriority;
    subject?: RunSubject | null;
    spec: RunSpec;
    placement?: RunnerPlacement;
  }): Run {
    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority ?? RunPriority.normal,
      input.subject ?? null,
      input.spec,
      input.placement ?? RunnerPlacement.anywhere(),
      'queued',
      null,
      null,
      null,
      1,
      null,
      null,
      Provisioning.none(),
      null,
    );
  }

  static rehydrate(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority: RunPriority;
    subject: RunSubject | null;
    spec: RunSpec;
    placement?: RunnerPlacement;
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    outcome: RunOutcome | null;
    attempt: number;
    stopRequestedAt?: Date | null;
    reservation: RunnerReservation | null;
    provisioning: Provisioning;
    ranIn?: RunnerImage | null;
    version?: number;
  }): Run {
    Run.guardReconstituted(input);

    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority,
      input.subject,
      input.spec,
      input.placement ?? RunnerPlacement.anywhere(),
      input.state,
      input.claimedBy,
      input.leaseExpiresAt,
      input.outcome,
      input.attempt,
      input.stopRequestedAt ?? null,
      input.reservation,
      input.provisioning,
      input.ranIn ?? null,
      input.version ?? 0,
    );
  }

  private static guardReconstituted(input: {
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    attempt: number;
  }): void {
    if (input.attempt < 1) {
      throw new InconsistentStateError('run', 'has no attempt to its name');
    }
    if (input.state === 'claimed' && !input.claimedBy) {
      throw new InconsistentStateError('run', 'is claimed by nobody');
    }
    if (input.state === 'claimed' && !input.leaseExpiresAt) {
      throw new InconsistentStateError('run', 'is claimed with no lease');
    }
    if (input.state === 'queued' && (input.claimedBy || input.leaseExpiresAt)) {
      throw new InconsistentStateError(
        'run',
        'is queued yet still held by a runner',
      );
    }
  }

  get taskId(): TaskId | null {
    return this.subject?.taskId ?? null;
  }

  get stationId(): StationId | null {
    return this.subject?.stationId ?? null;
  }

  get chatId(): ChatId | null {
    return this.subject?.chatId ?? null;
  }

  claim(by: RunnerId, now: Date): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `cannot be claimed while it is ${this.state}`,
      );
    }
    if (this.isReservedAt(now) && !this.reservation?.heldFor(by)) {
      throw new InvalidRunTransitionError(
        'cannot be claimed while it waits for the runner provisioned for it',
      );
    }

    return this.with({
      state: 'claimed',
      claimedBy: by,
      leaseExpiresAt: this.leaseFrom(now),
      reservation: null,
    });
  }

  isReservedAt(now: Date): boolean {
    return this.reservation?.holdsAt(now) ?? false;
  }

  reservationLapsedAt(now: Date): boolean {
    return (
      this.state === 'queued' &&
      this.reservation !== null &&
      !this.reservation.holdsAt(now)
    );
  }

  provisionableAt(now: Date): boolean {
    return (
      this.state === 'queued' &&
      this.reservation === null &&
      this.provisioning.dueAt(now)
    );
  }

  reservedFor(runner: RunnerId, pool: string, now: Date): Run {
    if (this.wearsSecrets) {
      throw new InvalidRunTransitionError(
        'cannot be reserved for a runner a pool provisions while it wears secrets, which only the egress beside a host’s sandbox wears',
      );
    }

    if (!this.provisionableAt(now)) {
      throw new InvalidRunTransitionError(
        `cannot be reserved for a runner to be provisioned while it is ${this.state}${this.reservation ? ' and reserved' : ''}`,
      );
    }

    return this.with({
      reservation: RunnerReservation.from(runner, pool, now),
    });
  }

  unreservedFor(runner: RunnerId): Run {
    if (this.state !== 'queued' || !this.reservation?.heldFor(runner)) {
      return this;
    }

    return this.with({ reservation: null });
  }

  provisionFailed(runner: RunnerId, failure: ProvisionFailure, now: Date): Run {
    if (this.state !== 'queued' || !this.reservation?.heldFor(runner)) {
      return this;
    }

    const provisioning = this.provisioning.failedAt(now);

    if (!provisioning.exhausted) {
      return this.with({ reservation: null, provisioning });
    }

    const outcome = RunOutcome.unprovisioned(failure, provisioning.failures);
    const failed = this.with({
      state: 'failed',
      reservation: null,
      provisioning,
      outcome,
    });

    failed.record(
      new RunCompleted(
        this.id,
        this.workspaceId,
        this.subject,
        outcome,
        null,
        null,
        null,
      ),
    );

    return failed;
  }

  requeue(now: Date): Run {
    if (!this.lapsed(now)) {
      throw new InvalidRunTransitionError(
        `cannot be requeued while it is ${this.state} and its lease holds`,
      );
    }

    if (this.attempt >= MAX_ATTEMPTS) {
      return this.givenUp(`no runner finished it in ${MAX_ATTEMPTS} attempts`);
    }

    return this.backOnTheQueue();
  }

  private givenUp(reason: string): Run {
    const abandoned = this.with({
      state: 'failed',
      claimedBy: null,
      leaseExpiresAt: null,
      outcome: RunOutcome.abandoned(reason),
    });

    abandoned.record(
      new RunAbandoned(this.id, this.workspaceId, this.subject, this.attempt),
    );

    return abandoned;
  }

  private backOnTheQueue(): Run {
    return this.with({
      state: 'queued',
      claimedBy: null,
      leaseExpiresAt: null,
      attempt: this.attempt + 1,
      reservation: null,
      provisioning: Provisioning.none(),
      ranIn: null,
    });
  }

  release(): Run {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot be released while it is ${this.state}`,
      );
    }

    return this.backOnTheQueue();
  }

  startedIn(by: RunnerId, image: RunnerImage): Run {
    this.requireHeldBy(by, 'start');

    if (!image.isPinned) {
      throw new InvalidRunTransitionError(
        `records the image it runs in by digest, not by ${image.value}`,
      );
    }

    const wanted = this.placement.image;

    if (wanted && wanted.repository !== image.repository) {
      throw new InvalidRunTransitionError(
        `runs in ${wanted.value}, not ${image.value}`,
      );
    }

    return this.with({ ranIn: image });
  }

  renewLease(by: RunnerId, now: Date): Run {
    this.requireHeldBy(by, 'renew the lease on');

    return this.with({ leaseExpiresAt: this.leaseFrom(now) });
  }

  complete(
    by: RunnerId,
    outcome: RunOutcome,
    said: HandoverReport = HandoverReport.none(),
  ): Run {
    this.requireHeldBy(by, 'complete');

    const ended = this.with({
      state: outcome.failed ? 'failed' : 'completed',
      outcome,
      leaseExpiresAt: null,
    });

    ended.record(
      new RunCompleted(
        this.id,
        this.workspaceId,
        this.subject,
        outcome,
        by,
        said.declared ?? null,
        said.session ?? null,
      ),
    );

    return ended;
  }

  refused(outcome: RunOutcome): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `cannot be refused while it is ${this.state}`,
      );
    }

    const refused = this.with({ state: 'failed', outcome });

    refused.record(
      new RunCompleted(
        this.id,
        this.workspaceId,
        this.subject,
        outcome,
        null,
        null,
        null,
      ),
    );

    return refused;
  }

  withdrawn(reason: string): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `cannot be withdrawn while it is ${this.state}`,
      );
    }

    const withdrawn = this.with({
      state: 'failed',
      outcome: RunOutcome.abandoned(reason),
    });

    withdrawn.record(new RunWithdrawn(this.id, this.workspaceId, this.subject));

    return withdrawn;
  }

  requestStop(now: Date): Run {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot be stopped while it is ${this.state}`,
      );
    }

    if (this.stopRequested) {
      return this;
    }

    const stopping = this.with({ stopRequestedAt: now });

    stopping.record(new RunStopRequested(this.id, this.subject, now));

    return stopping;
  }

  get hasCompleted(): boolean {
    return this.state === 'completed';
  }

  get hasEnded(): boolean {
    return this.state === 'completed' || this.state === 'failed';
  }

  get stopRequested(): boolean {
    return this.stopRequestedAt !== null;
  }

  wasWorkedBy(runner: RunnerId): boolean {
    return this.claimedBy?.equals(runner) ?? false;
  }

  assertHeldBy(by: RunnerId): void {
    this.requireHeldBy(by, 'act on');
  }

  journalFor(by: RunnerId): RunAttempt {
    this.requireHeldBy(by, 'journal');

    return RunAttempt.of(this.id, this.attempt);
  }

  get wearsSecrets(): boolean {
    return this.spec.wears.length > 0;
  }

  secretsWornFor(runner: RunnerId): readonly string[] {
    return this.state === 'claimed' && this.wasWorkedBy(runner)
      ? this.spec.wears
      : [];
  }

  wasGiven(tool: Tool): boolean {
    return this.spec.gives(tool);
  }

  pinnedFor(tool: Tool): Tool | null {
    return this.spec.pinned(tool);
  }

  lapsed(now: Date): boolean {
    return (
      this.state === 'claimed' &&
      this.leaseExpiresAt !== null &&
      this.leaseExpiresAt.getTime() <= now.getTime()
    );
  }

  private with(part: {
    state?: RunState;
    claimedBy?: RunnerId | null;
    leaseExpiresAt?: Date | null;
    outcome?: RunOutcome | null;
    attempt?: number;
    stopRequestedAt?: Date | null;
    reservation?: RunnerReservation | null;
    provisioning?: Provisioning;
    ranIn?: RunnerImage | null;
  }): Run {
    const next = new Run(
      this.id,
      this.workspaceId,
      this.harness,
      this.priority,
      this.subject,
      this.spec,
      this.placement,
      part.state ?? this.state,
      part.claimedBy !== undefined ? part.claimedBy : this.claimedBy,
      part.leaseExpiresAt !== undefined
        ? part.leaseExpiresAt
        : this.leaseExpiresAt,
      part.outcome !== undefined ? part.outcome : this.outcome,
      part.attempt ?? this.attempt,
      part.stopRequestedAt !== undefined
        ? part.stopRequestedAt
        : this.stopRequestedAt,
      part.reservation !== undefined ? part.reservation : this.reservation,
      part.provisioning ?? this.provisioning,
      part.ranIn !== undefined ? part.ranIn : this.ranIn,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }

  private leaseFrom(now: Date): Date {
    return new Date(now.getTime() + LEASE_DURATION_MS);
  }

  private requireHeldBy(by: RunnerId, action: string): void {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot ${action} a run that is ${this.state}`,
      );
    }
    if (!this.claimedBy?.equals(by)) {
      throw new InvalidRunTransitionError(
        `cannot ${action} a run claimed by another runner`,
      );
    }
  }
}
