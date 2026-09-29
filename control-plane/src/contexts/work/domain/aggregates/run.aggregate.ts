import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunBriefed } from '@work/domain/events/run-briefed.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunLapsed } from '@work/domain/events/run-lapsed.event';
import { RunParked } from '@work/domain/events/run-parked.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import { RunResumed } from '@work/domain/events/run-resumed.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { RunSuperseded } from '@work/domain/events/run-superseded.event';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { RunAttemptOverError } from '@work/domain/exceptions/run-attempt-over.error';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { HandBacks } from '@work/domain/value-objects/hand-backs.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import {
  HELD_RUN_STATES,
  type RunState,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

const LEASE_DURATION_MS = 60_000;

const LOST = RunFailure.of('runner-lost').retry;

const LET_GO_QUEUED = 'Its task moved on before a runner took it up.';

const endingIn = (outcome: RunOutcome): RunState =>
  outcome.superseded ? 'superseded' : outcome.failed ? 'failed' : 'completed';

const isHeld = (state: RunState): boolean =>
  (HELD_RUN_STATES as readonly RunState[]).includes(state);

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
    readonly handBacks: HandBacks,
    readonly briefedWith: BriefedMemories = BriefedMemories.none(),
    readonly parkedAttempts: readonly number[] = [],
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
    briefedWith?: BriefedMemories;
  }): Run {
    const run = new Run(
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
      HandBacks.none(),
      input.briefedWith ?? BriefedMemories.none(),
    );

    if (run.briefedWith.briefed.length > 0) {
      run.record(new RunBriefed(run.id, run.workspaceId, run.briefedWith));
    }

    return run;
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
    handBacks?: HandBacks;
    briefedWith?: BriefedMemories;
    parkedAttempts?: readonly number[];
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
      input.handBacks ?? HandBacks.none(),
      input.briefedWith ?? BriefedMemories.none(),
      [...(input.parkedAttempts ?? [])],
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
    if (isHeld(input.state) && !input.claimedBy) {
      throw new InconsistentStateError('run', `is ${input.state} by nobody`);
    }
    if (isHeld(input.state) && !input.leaseExpiresAt) {
      throw new InconsistentStateError(
        'run',
        `is ${input.state} with no lease`,
      );
    }
    if (
      (input.state === 'queued' || input.state === 'parked') &&
      (input.claimedBy || input.leaseExpiresAt)
    ) {
      throw new InconsistentStateError(
        'run',
        `is ${input.state} yet still held by a runner`,
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

  get continuity(): ContinuityKey | null {
    return this.spec.continuity;
  }

  get archiveHolder(): ArchiveHolder | null {
    return this.subject?.archiveHolder ?? null;
  }

  get restoresFrom(): ContinuityKey | null {
    return this.spec.continuesASession ? this.spec.continuity : null;
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

    const claimed = this.with({
      state: 'claimed',
      claimedBy: by,
      leaseExpiresAt: this.leaseFrom(now),
      reservation: null,
    });

    if (this.reservation && !this.reservation.heldFor(by)) {
      claimed.recordReservationDropped(this.reservation.runner);
    }

    return claimed;
  }

  provisionRefusedBy(
    runner: RunnerId,
    harnesses: readonly HarnessId[],
  ): ProvisionFailure | null {
    if (
      this.state !== 'queued' ||
      !this.reservation?.heldFor(runner) ||
      harnesses.some((each) => each.equals(this.harness))
    ) {
      return null;
    }

    return ProvisionFailure.harnessMissing(this.harness.value);
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
      !this.wearsSecrets &&
      this.provisioning.dueAt(now) &&
      this.handBacks.claimableAt(now)
    );
  }

  reservedFor(runner: RunnerId, pool: PoolId, now: Date): Run {
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

    const unreserved = this.with({ reservation: null });
    unreserved.recordReservationDropped(runner);

    return unreserved;
  }

  provisionFailed(runner: RunnerId, failure: ProvisionFailure, now: Date): Run {
    if (this.state !== 'queued' || !this.reservation?.heldFor(runner)) {
      return this;
    }

    const provisioning = this.provisioning.failedAt(failure, now);

    if (!provisioning.exhausted) {
      const retried = this.with({ reservation: null, provisioning });
      retried.recordReservationDropped(runner);

      return retried;
    }

    const outcome = RunOutcome.unprovisioned(failure, provisioning.failures);
    const failed = this.with({
      state: endingIn(outcome),
      reservation: null,
      provisioning,
      outcome,
    });

    failed.recordReservationDropped(runner);

    failed.record(
      new RunCompleted(
        this.id,
        this.workspaceId,
        this.subject,
        outcome,
        null,
        null,
        null,
        this.attempt,
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

    const next =
      this.state === 'waiting'
        ? this.leftWaiting(null)
        : LOST.exhaustedAfter(this.lapses)
          ? this.givenUp(RunOutcome.lost(this.lapses))
          : this.backOnTheQueue();

    if (this.claimedBy) {
      next.record(
        new RunLapsed(
          this.id,
          this.workspaceId,
          this.claimedBy,
          now,
          this.attempt,
        ),
      );
    }

    return next;
  }

  private get lapses(): number {
    return this.attempt - this.parkedAttempts.length;
  }

  private givenUp(outcome: RunOutcome): Run {
    const abandoned = this.with({
      state: endingIn(outcome),
      claimedBy: null,
      leaseExpiresAt: null,
      outcome,
    });

    abandoned.record(
      new RunAbandoned(
        this.id,
        this.workspaceId,
        this.subject,
        this.attempt,
        this.lapses,
      ),
    );

    return abandoned;
  }

  private backOnTheQueue(): Run {
    return this.with({
      state: 'queued',
      outcome: null,
      claimedBy: null,
      leaseExpiresAt: null,
      attempt: this.attempt + 1,
      reservation: null,
      provisioning: Provisioning.none(),
      ranIn: null,
      handBacks: HandBacks.none(),
    });
  }

  unclaimedBy(by: RunnerId): Run {
    this.requireWorkedBy(by, 'unclaim');

    if (this.ranIn) {
      throw new InvalidRunTransitionError(
        'cannot be unclaimed once it has started',
      );
    }

    return this.with({
      state: 'queued',
      claimedBy: null,
      leaseExpiresAt: null,
    });
  }

  startedIn(by: RunnerId, image: RunnerImage): Run {
    this.requireWorkedBy(by, 'start');

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
      state: endingIn(outcome),
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
        this.attempt,
      ),
    );

    return ended;
  }

  paused(
    by: RunnerId,
    outcome: RunOutcome,
    said: HandoverReport,
    now: Date,
  ): Run {
    this.requireWorkedBy(by, 'pause');

    if (!outcome.handsOver) {
      throw new InvalidRunTransitionError(
        'cannot wait for a person on a turn that failed or was stopped',
      );
    }

    if (this.stopRequested) {
      throw new InvalidRunTransitionError(
        'cannot wait for a person once it has been asked to stop',
      );
    }

    const waiting = this.with({
      state: 'waiting',
      leaseExpiresAt: this.leaseFrom(now),
      spec: this.spec.resumingIn(said.session),
      outcome,
    });

    waiting.record(
      new RunPaused(
        this.id,
        this.workspaceId,
        this.subject,
        by,
        outcome,
        said.declared,
        said.session,
        this.attempt,
        now,
      ),
    );

    return waiting;
  }

  get waitsForAPerson(): boolean {
    return this.state === 'waiting' || this.state === 'parked';
  }

  pausedBy(runner: RunnerId): boolean {
    return this.state === 'waiting' && this.wasWorkedBy(runner);
  }

  get resumable(): boolean {
    return (
      this.state === 'parked' ||
      (this.state === 'waiting' && !this.stopRequested)
    );
  }

  resumed(): Run {
    if (!this.resumable) {
      throw new InvalidRunTransitionError(
        `cannot be taken up again while it is ${this.state}${this.stopRequested ? ' and asked to stop' : ''}`,
      );
    }

    const warm = this.state === 'waiting';
    const resumed = warm
      ? this.with({ state: 'claimed', outcome: null })
      : this.backOnTheQueue();

    resumed.record(
      new RunResumed(
        this.id,
        this.workspaceId,
        this.subject,
        resumed.attempt,
        warm,
      ),
    );

    return resumed;
  }

  park(by: RunnerId, now: Date, cold = false): Run {
    this.requireHeldBy(by, 'park');

    if (this.state !== 'waiting') {
      return cold ? this.parkedCold(by, now) : this;
    }

    const parked = this.leftWaiting(by);

    if (parked.state === 'parked') {
      parked.record(
        new RunParked(this.id, this.workspaceId, by, now, this.attempt),
      );
    }

    return parked;
  }

  private parkedCold(by: RunnerId, now: Date): Run {
    if (this.state !== 'claimed' || !this.spec.resumes) {
      throw new InvalidRunTransitionError(
        'is parked cold only once a person’s answer has taken it up from a pause',
      );
    }

    if (this.stopRequested) {
      return this.leftWaiting(by);
    }

    const requeued = this.with({
      parkedAttempts: [...this.parkedAttempts, this.attempt],
    }).backOnTheQueue();

    requeued.record(
      new RunParked(this.id, this.workspaceId, by, now, this.attempt),
    );

    return requeued;
  }

  private leftWaiting(by: RunnerId | null): Run {
    if (this.stopRequested) {
      const outcome = RunOutcome.stopped(by ? 0 : -1);
      const ended = this.with({
        state: endingIn(outcome),
        leaseExpiresAt: null,
        outcome,
      });

      ended.record(
        new RunCompleted(
          this.id,
          this.workspaceId,
          this.subject,
          outcome,
          by,
          null,
          null,
          this.attempt,
        ),
      );

      return ended;
    }

    return this.with({
      state: 'parked',
      claimedBy: null,
      leaseExpiresAt: null,
      parkedAttempts: [...this.parkedAttempts, this.attempt],
    });
  }

  refused(outcome: RunOutcome): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `cannot be refused while it is ${this.state}`,
      );
    }

    const refused = this.endedQueued(outcome);

    refused.record(
      new RunCompleted(
        this.id,
        this.workspaceId,
        this.subject,
        outcome,
        null,
        null,
        null,
        this.attempt,
      ),
    );

    return refused;
  }

  claimableAt(now: Date): boolean {
    return this.handBacks.claimableAt(now);
  }

  handedBack(by: RunnerId, now: Date, because: string): Run {
    this.requireWorkedBy(by, 'hand back');

    if (this.stopRequested) {
      return this.endedUnstarted(RunOutcome.stopped(-1));
    }

    const handBacks = this.handBacks.handedBackAt(now);

    if (handBacks.exhausted) {
      return this.endedUnstarted(
        RunOutcome.unanswered(because, handBacks.count),
      );
    }

    return this.with({
      state: 'queued',
      claimedBy: null,
      leaseExpiresAt: null,
      reservation: null,
      ranIn: null,
      handBacks,
    });
  }

  private endedUnstarted(outcome: RunOutcome): Run {
    const ended = this.with({
      state: endingIn(outcome),
      claimedBy: null,
      leaseExpiresAt: null,
      outcome,
    });

    ended.record(
      new RunCompleted(
        this.id,
        this.workspaceId,
        this.subject,
        outcome,
        null,
        null,
        null,
        this.attempt,
      ),
    );

    return ended;
  }

  refusedToStart(by: RunnerId, reason: string): Run {
    this.requireWorkedBy(by, 'refuse to start');

    return this.endedUnstarted(RunOutcome.refused([{ saying: reason }]));
  }

  letGo(now: Date): Run {
    switch (this.state) {
      case 'queued':
        return this.withdrawn(LET_GO_QUEUED);
      case 'claimed':
        return this.requestStop(now);
      case 'waiting':
      case 'parked':
        return this.endedAsItPaused();
      default:
        return this;
    }
  }

  private endedAsItPaused(): Run {
    const outcome =
      this.outcome ?? RunOutcome.of({ exitCode: 0, failed: false });
    const ended = this.with({
      state: endingIn(outcome),
      leaseExpiresAt: null,
      outcome,
    });

    ended.record(
      new RunCompleted(
        this.id,
        this.workspaceId,
        this.subject,
        outcome,
        this.claimedBy,
        null,
        null,
        this.attempt,
      ),
    );

    return ended;
  }

  withdrawn(reason: string): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `cannot be withdrawn while it is ${this.state}`,
      );
    }

    const outcome = RunOutcome.superseded(reason);
    const withdrawn = this.endedQueued(outcome);

    withdrawn.record(
      new RunWithdrawn(this.id, this.workspaceId, this.subject, this.attempt),
    );

    return withdrawn;
  }

  private endedQueued(outcome: RunOutcome): Run {
    const ended = this.with({
      state: endingIn(outcome),
      outcome,
      reservation: null,
    });

    if (this.reservation) {
      ended.recordReservationDropped(this.reservation.runner);
    }

    return ended;
  }

  supersededByItsTask(): Run {
    if (!this.hasEnded || !this.outcome?.failed || this.outcome.superseded) {
      return this;
    }

    const superseded = this.with({
      state: 'superseded',
      outcome: this.outcome.supersede(),
    });

    superseded.record(
      new RunSuperseded(this.id, this.workspaceId, this.subject),
    );

    return superseded;
  }

  requestStop(now: Date): Run {
    if (this.state === 'parked') {
      return this.endedUnstarted(RunOutcome.stopped(-1));
    }

    if (!isHeld(this.state)) {
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
    return (TERMINAL_RUN_STATES as readonly RunState[]).includes(this.state);
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

    return this.currentAttempt;
  }

  get currentAttempt(): RunAttempt {
    return RunAttempt.of(this.id, this.attempt);
  }

  assertStillOn(attempt: RunAttempt, by: RunnerId): void {
    if (!this.isHeldBy(by) || !attempt.equals(this.currentAttempt)) {
      throw new RunAttemptOverError(this.id.value, attempt.number);
    }
  }

  get wearsSecrets(): boolean {
    return this.spec.wears.length > 0;
  }

  isHeldBy(runner: RunnerId): boolean {
    return isHeld(this.state) && this.wasWorkedBy(runner);
  }

  secretsWornFor(runner: RunnerId): readonly SecretName[] {
    return this.isHeldBy(runner) ? this.spec.wears : [];
  }

  wasGiven(tool: Tool): boolean {
    return this.spec.gives(tool);
  }

  pinnedFor(tool: Tool): Tool | null {
    return this.spec.pinned(tool);
  }

  lapsed(now: Date): boolean {
    return (
      isHeld(this.state) &&
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
    handBacks?: HandBacks;
    spec?: RunSpec;
    parkedAttempts?: readonly number[];
  }): Run {
    const next = new Run(
      this.id,
      this.workspaceId,
      this.harness,
      this.priority,
      this.subject,
      part.spec ?? this.spec,
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
      part.handBacks ?? this.handBacks,
      this.briefedWith,
      part.parkedAttempts ?? this.parkedAttempts,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }

  private recordReservationDropped(runner: RunnerId): void {
    this.record(new RunReservationDropped(this.id, this.workspaceId, runner));
  }

  private leaseFrom(now: Date): Date {
    return new Date(now.getTime() + LEASE_DURATION_MS);
  }

  private requireWorkedBy(by: RunnerId, action: string): void {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot ${action} a run that is ${this.state}`,
      );
    }

    this.requireHeldBy(by, action);
  }

  private requireHeldBy(by: RunnerId, action: string): void {
    if (!isHeld(this.state)) {
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
