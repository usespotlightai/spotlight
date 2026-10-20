import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunBriefed } from '@work/domain/events/run-briefed.event';
import { RunCancelled } from '@work/domain/events/run-cancelled.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@work/domain/events/run-lease-expired.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import { RunResumed } from '@work/domain/events/run-resumed.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { RunSuperseded } from '@work/domain/events/run-superseded.event';
import { RunSuspended } from '@work/domain/events/run-suspended.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import { NotAllowedInReplayError } from '@work/domain/exceptions/not-allowed-in-replay.error';
import { NotAllowedInSearchError } from '@work/domain/exceptions/not-allowed-in-search.error';
import { RunAttemptOverError } from '@work/domain/exceptions/run-attempt-over.error';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RequeueCount } from '@work/domain/value-objects/requeue-count.vo';
import type { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import type { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import {
  LEASED_RUN_STATES,
  type RunState,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import type { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import {
  type ReportedStart,
  StartingPoint,
} from '@work/domain/value-objects/starting-point.vo';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

const LEASE_DURATION_MS = 60_000;

export interface RunStart {
  readonly restored: RestoredArchive | null;
  readonly checkouts: readonly StartedCheckout[];
}

const LOST = RunFailure.of('runner-lost').retry;

const CANCELLED_QUEUED = 'Task moved on before a runner claimed the run.';

const endingIn = (outcome: RunOutcome): RunState =>
  outcome.cancelled
    ? 'cancelled'
    : outcome.superseded
      ? 'superseded'
      : outcome.failed
        ? 'failed'
        : 'completed';

const isLeased = (state: RunState): boolean =>
  (LEASED_RUN_STATES as readonly RunState[]).includes(state);

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
    readonly requeueCount: RequeueCount,
    readonly briefedWith: BriefedMemories = BriefedMemories.none(),
    readonly suspendedAttempts: readonly number[] = [],
    readonly configuredAs: StationConfig | null = null,
    readonly startedAt: Date | null = null,
    readonly startedFrom: StartingPoint | null = null,
    readonly askedAPerson: boolean = false,
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
    configuredAs?: StationConfig | null;
    briefedTask?: BriefedTask | null;
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
      RequeueCount.none(),
      input.briefedWith ?? BriefedMemories.none(),
      [],
      input.configuredAs ?? null,
    );

    if (run.isReplay !== run.spec.isReplay) {
      throw new InvalidRunTransitionError(
        `Run ${run.id.value} and its spec disagree on what it replays.`,
      );
    }

    if (run.isSearch !== run.spec.isSearch) {
      throw new InvalidRunTransitionError(
        `Run ${run.id.value} and its spec disagree on whether it searches.`,
      );
    }

    if (run.configuredAs && !run.stationId) {
      throw new InvalidRunTransitionError(
        `Run ${run.id.value} works at no station. It cannot record a station config.`,
      );
    }

    if (run.isReplay && !run.configuredAs) {
      throw new InvalidRunTransitionError(
        `Run ${run.id.value} is a replay without a station config.`,
      );
    }

    const briefed = input.briefedTask ?? null;

    if (briefed && !run.taskId) {
      throw new InvalidRunTransitionError(
        `Run ${run.id.value} works no task. It cannot record a briefed task.`,
      );
    }

    if (briefed && !run.stationId?.equals(briefed.stationId)) {
      throw new InvalidRunTransitionError(
        `Run ${run.id.value} cannot record a task briefed at another station.`,
      );
    }

    if (run.briefedWith.briefed.length > 0 && run.isSearch) {
      throw new InvalidRunTransitionError(
        `Run ${run.id.value} is a search. Searches are not briefed with team memories.`,
      );
    }

    if (run.briefedWith.briefed.length > 0 && !run.isReplay) {
      run.record(
        new RunBriefed(run.id, run.workspaceId, run.taskId, run.briefedWith),
      );
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
    requeueCount?: RequeueCount;
    briefedWith?: BriefedMemories;
    suspendedAttempts?: readonly number[];
    configuredAs?: StationConfig | null;
    startedAt?: Date | null;
    startedFrom?: StartingPoint | null;
    askedAPerson?: boolean;
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
      input.requeueCount ?? RequeueCount.none(),
      input.briefedWith ?? BriefedMemories.none(),
      [...(input.suspendedAttempts ?? [])],
      input.configuredAs ?? null,
      input.startedAt ?? null,
      input.startedFrom ?? null,
      input.askedAPerson ?? false,
      input.version ?? 0,
    );
  }

  private static guardReconstituted(input: {
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    attempt: number;
    subject: RunSubject | null;
    spec: RunSpec;
    startedFrom?: StartingPoint | null;
    askedAPerson?: boolean;
    configuredAs?: StationConfig | null;
  }): void {
    if (input.attempt < 1) {
      throw new InconsistentStateError('run', 'has no attempt to its name');
    }
    if ((input.subject?.isReplay ?? false) !== input.spec.isReplay) {
      throw new InconsistentStateError(
        'run',
        'replays a run with a spec that does not say what it replays, or the other way round',
      );
    }
    if (input.subject?.isReplay && !input.configuredAs) {
      throw new InconsistentStateError(
        'run',
        'replays a run without the station config it replays with',
      );
    }
    if ((input.subject?.isSearch ?? false) !== input.spec.isSearch) {
      throw new InconsistentStateError(
        'run',
        'searches with a spec that does not say it searches, or the other way round',
      );
    }
    if (input.askedAPerson && !input.subject?.leavesNothingBehind) {
      throw new InconsistentStateError(
        'run',
        'asked a person itself though it is no replay or search',
      );
    }
    if (input.startedFrom && !input.subject?.taskId) {
      throw new InconsistentStateError(
        'run',
        'started from somewhere though it works no task',
      );
    }
    if (input.startedFrom && input.startedFrom.attempt > input.attempt) {
      throw new InconsistentStateError(
        'run',
        'started from somewhere on an attempt it has not made yet',
      );
    }
    if (isLeased(input.state) && !input.claimedBy) {
      throw new InconsistentStateError('run', `is ${input.state} by nobody`);
    }
    if (isLeased(input.state) && !input.leaseExpiresAt) {
      throw new InconsistentStateError(
        'run',
        `is ${input.state} with no lease`,
      );
    }
    if (
      (input.state === 'queued' || input.state === 'suspended') &&
      (input.claimedBy || input.leaseExpiresAt)
    ) {
      throw new InconsistentStateError(
        'run',
        `is ${input.state} yet still leased by a runner`,
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

  get isReplay(): boolean {
    return this.subject?.isReplay ?? false;
  }

  get replayOf(): RunId | null {
    return this.subject?.replayOf ?? null;
  }

  get isSearch(): boolean {
    return this.subject?.isSearch ?? false;
  }

  get leavesNothingBehind(): boolean {
    return this.subject?.leavesNothingBehind ?? false;
  }

  get restoresArchive(): WorkspaceArchiveId | null {
    const archive = this.spec.replay?.archive ?? null;

    return archive ? WorkspaceArchiveId.of(archive) : null;
  }

  get resumeKey(): ResumeKey | null {
    return this.spec.resumeKey;
  }

  get archiveHolder(): ArchiveHolder | null {
    return this.subject?.archiveHolder ?? null;
  }

  get restoresFrom(): ResumeKey | null {
    const restores =
      this.archiveHolder?.kind === 'task' || this.spec.continuesASession;

    return restores ? this.spec.resumeKey : null;
  }

  claim(by: RunnerId, now: Date): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is ${this.state}. It cannot be claimed.`,
      );
    }
    if (this.isReservedAt(now) && !this.reservation?.isFor(by)) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is waiting for the runner provisioned for it.`,
      );
    }

    const claimed = this.with({
      state: 'claimed',
      claimedBy: by,
      leaseExpiresAt: this.leaseFrom(now),
      reservation: null,
    });

    if (this.reservation && !this.reservation.isFor(by)) {
      claimed.recordReservationDropped(this.reservation.runner);
    }

    return claimed;
  }

  provisionFailureFor(
    runner: RunnerId,
    harnesses: readonly HarnessId[],
  ): ProvisionFailure | null {
    if (
      this.state !== 'queued' ||
      !this.reservation?.isFor(runner) ||
      harnesses.some((each) => each.equals(this.harness))
    ) {
      return null;
    }

    return ProvisionFailure.harnessMissing(this.harness.value);
  }

  isReservedAt(now: Date): boolean {
    return this.reservation?.isActiveAt(now) ?? false;
  }

  reservationExpiredAt(now: Date): boolean {
    return (
      this.state === 'queued' &&
      this.reservation !== null &&
      !this.reservation.isActiveAt(now)
    );
  }

  provisionableAt(now: Date, withEgress = false): boolean {
    return (
      this.state === 'queued' &&
      this.reservation === null &&
      (withEgress || !this.injectsSecrets) &&
      this.provisioning.isDue(now) &&
      this.requeueCount.claimableAt(now)
    );
  }

  reservedFor(
    runner: RunnerId,
    pool: PoolId,
    now: Date,
    withEgress = false,
  ): Run {
    if (this.injectsSecrets && !withEgress) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} carries secrets or a Spotlight token. Only a sandbox with egress can run it: a host, or a push pool that names an egress.`,
      );
    }

    if (!this.provisionableAt(now, withEgress)) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is ${this.state}${this.reservation ? ' and reserved' : ''}. It cannot be reserved for a new runner.`,
      );
    }

    return this.with({
      reservation: RunnerReservation.from(runner, pool, now),
    });
  }

  unreservedFor(runner: RunnerId): Run {
    if (this.state !== 'queued' || !this.reservation?.isFor(runner)) {
      return this;
    }

    const unreserved = this.with({ reservation: null });
    unreserved.recordReservationDropped(runner);

    return unreserved;
  }

  provisionFailed(runner: RunnerId, failure: ProvisionFailure, now: Date): Run {
    if (this.state !== 'queued' || !this.reservation?.isFor(runner)) {
      return this;
    }

    const provisioning = this.provisioning.recordFailure(failure, now);

    if (!provisioning.exhausted) {
      const retried = this.with({ reservation: null, provisioning });
      retried.recordReservationDropped(runner);

      return retried;
    }

    const outcome = RunOutcome.unprovisioned(failure, provisioning.attempts);
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
        failed.askedAPerson,
      ),
    );

    return failed;
  }

  expireLease(now: Date): Run {
    if (!this.leaseExpired(now)) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is ${this.state} and its lease is still valid. Its lease cannot expire yet.`,
      );
    }

    return this.lostTo(now, RunOutcome.lost);
  }

  timedOut(by: RunnerId, now: Date): Run {
    this.requireLeasedBy(by, 'time out');

    return this.lostTo(now, RunOutcome.timedOut);
  }

  private lostTo(now: Date, outcome: (attempts: number) => RunOutcome): Run {
    const next =
      this.state === 'waiting'
        ? this.leftWaiting(null)
        : this.stopRequested
          ? this.endedAsStopped(null)
          : LOST.exhaustedAfter(this.expiredLeases) || this.askedAPerson
            ? this.exhaust(outcome(this.expiredLeases))
            : this.backOnTheQueue();

    if (this.claimedBy) {
      next.record(
        new RunLeaseExpired(
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

  private get expiredLeases(): number {
    return this.attempt - this.suspendedAttempts.length;
  }

  private exhaust(outcome: RunOutcome): Run {
    const exhausted = this.with({
      state: endingIn(outcome),
      claimedBy: null,
      leaseExpiresAt: null,
      outcome,
    });

    exhausted.record(
      new RunExhausted(
        this.id,
        this.workspaceId,
        this.subject,
        this.attempt,
        this.expiredLeases,
        this.askedAPerson,
        outcome.failure?.code ?? null,
      ),
    );

    return exhausted;
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
      startedAt: null,
      requeueCount: RequeueCount.none(),
    });
  }

  unclaimedBy(by: RunnerId): Run {
    this.requireClaimedBy(by, 'unclaim');

    if (this.ranIn) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} has started. It cannot be unclaimed.`,
      );
    }

    return this.with({
      state: 'queued',
      claimedBy: null,
      leaseExpiresAt: null,
      startedAt: null,
    });
  }

  startedIn(by: RunnerId, image: RunnerImage, now: Date): Run {
    this.requireClaimedBy(by, 'start');

    if (!image.isPinned) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} must record its image by digest, not ${image.value}.`,
      );
    }

    const wanted = this.placement.image;

    if (wanted && wanted.repository !== image.repository) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} runs in ${wanted.value}, not ${image.value}.`,
      );
    }

    return this.with({ ranIn: image, startedAt: this.startedAt ?? now });
  }

  startsFrom(
    attempt: RunAttempt,
    by: RunnerId,
    started: RunStart,
    now: Date,
  ): Run {
    this.assertStillOn(attempt, by);
    this.requireClaimedBy(by, 'record the start of');

    if (!this.taskId) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} works no task. It cannot record a starting point.`,
      );
    }

    const { restored } = started;

    if (restored && !restored.restores(this.workspaceId, this.restoresFrom)) {
      throw new InvalidStartingPointError(
        `names archive ${restored.id.value}, which run ${this.id.value} did not restore`,
      );
    }

    const reported: ReportedStart = {
      archive: restored?.id ?? null,
      checkouts: started.checkouts,
    };

    if (this.startedFrom) {
      if (this.startedFrom.attempt < this.attempt) {
        return this;
      }

      if (this.startedFrom.sameAs(reported)) {
        return this;
      }

      throw new InvalidRunTransitionError(
        `Run ${this.id.value} already recorded a different starting point.`,
      );
    }

    const point = StartingPoint.of({
      ...reported,
      attempt: this.attempt,
      at: now,
    });
    const wanted = [...this.spec.checkoutFolders].sort();
    const named = point.paths;

    if (
      wanted.length !== named.length ||
      wanted.some((each, at) => each !== named[at])
    ) {
      throw new InvalidStartingPointError(
        `names the checkouts of the run (${wanted.join(', ') || 'none'}), not ${named.join(', ') || 'none'}`,
      );
    }

    return this.with({ startedFrom: point });
  }

  renewLease(by: RunnerId, now: Date): Run {
    this.requireLeasedBy(by, 'renew the lease on');

    return this.with({ leaseExpiresAt: this.leaseFrom(now) });
  }

  complete(
    by: RunnerId,
    outcome: RunOutcome,
    report: HandoverReport = HandoverReport.none(),
  ): Run {
    this.requireLeasedBy(by, 'complete');

    const ended = this.with({
      state: endingIn(outcome),
      outcome,
      leaseExpiresAt: null,
      askedAPerson:
        this.askedAPerson || this.replayAsksAfter(outcome, report.handover),
    });

    ended.record(
      new RunCompleted(
        this.id,
        this.workspaceId,
        this.subject,
        outcome,
        by,
        report.handover ?? null,
        report.session ?? null,
        this.attempt,
        ended.askedAPerson,
        report.lastWords,
      ),
    );

    return ended;
  }

  private replayAsksAfter(
    outcome: RunOutcome,
    handover: Handover | null,
  ): boolean {
    const replay = this.spec.replay;

    if (!replay || !outcome.handsOver) {
      return false;
    }

    return !(
      handover && replay.movesOnAfter.includes(handover.next.toLowerCase())
    );
  }

  replayedRepository(name: string): Repository | null {
    const checkout = this.spec.replay?.checkouts.find(
      (each) => each.path === name,
    );

    return checkout ? Repository.of(checkout.repository) : null;
  }

  get replayedRepositories(): readonly Repository[] {
    return (this.spec.replay?.checkouts ?? []).map((each) =>
      Repository.of(each.repository),
    );
  }

  get ranFor(): TeamId | null {
    return this.subject?.ranFor ?? null;
  }

  get firesHooks(): boolean {
    return !this.leavesNothingBehind;
  }

  mayActBeyondItself(what: string): void {
    if (this.isReplay) {
      throw new NotAllowedInReplayError(what);
    }
    if (this.isSearch) {
      throw new NotAllowedInSearchError(what);
    }
  }

  askedAPersonBy(by: RunnerId): Run {
    this.requireClaimedBy(by, 'ask a person on');

    if (!this.leavesNothingBehind) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} must ask a person through its task or chat.`,
      );
    }

    return this.askedAPerson ? this : this.with({ askedAPerson: true });
  }

  paused(
    by: RunnerId,
    outcome: RunOutcome,
    report: HandoverReport,
    now: Date,
  ): Run {
    this.requireClaimedBy(by, 'pause');

    if (this.leavesNothingBehind) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is a replay or a search. It never waits for a person.`,
      );
    }

    if (!outcome.handsOver) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} failed or was stopped. It cannot wait for a person.`,
      );
    }

    if (this.stopRequested) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} has a stop request. It cannot wait for a person.`,
      );
    }

    const waiting = this.with({
      state: 'waiting',
      leaseExpiresAt: this.leaseFrom(now),
      spec: this.spec.resumingIn(report.session),
      outcome,
    });

    waiting.record(
      new RunPaused(
        this.id,
        this.workspaceId,
        this.subject,
        by,
        outcome,
        report.handover,
        report.session,
        this.attempt,
        now,
      ),
    );

    return waiting;
  }

  get waitsForAPerson(): boolean {
    return this.state === 'waiting' || this.state === 'suspended';
  }

  pausedBy(runner: RunnerId): boolean {
    return this.state === 'waiting' && this.wasClaimedBy(runner);
  }

  get resumable(): boolean {
    return (
      this.state === 'suspended' ||
      (this.state === 'waiting' && !this.stopRequested)
    );
  }

  resumed(): Run {
    if (!this.resumable) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is ${this.state}${this.stopRequested ? ' and has a stop request' : ''}. It cannot be taken up again.`,
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

  suspend(by: RunnerId, now: Date, requeue = false): Run {
    this.requireLeasedBy(by, 'suspend');

    if (this.state !== 'waiting') {
      return requeue ? this.requeueToResume(by, now) : this;
    }

    const suspended = this.leftWaiting(by);

    if (suspended.state === 'suspended') {
      suspended.record(
        new RunSuspended(this.id, this.workspaceId, by, now, this.attempt),
      );
    }

    return suspended;
  }

  private requeueToResume(by: RunnerId, now: Date): Run {
    if (this.state !== 'claimed' || !this.spec.resumesSession) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} can be suspended only after an answer resumes it from a pause.`,
      );
    }

    if (this.stopRequested) {
      return this.leftWaiting(by);
    }

    const requeued = this.with({
      suspendedAttempts: [...this.suspendedAttempts, this.attempt],
    }).backOnTheQueue();

    requeued.record(
      new RunSuspended(this.id, this.workspaceId, by, now, this.attempt),
    );

    return requeued;
  }

  private leftWaiting(by: RunnerId | null): Run {
    if (this.stopRequested) {
      return this.endedAsStopped(by);
    }

    return this.with({
      state: 'suspended',
      claimedBy: null,
      leaseExpiresAt: null,
      suspendedAttempts: [...this.suspendedAttempts, this.attempt],
    });
  }

  private endedAsStopped(by: RunnerId | null): Run {
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
        ended.askedAPerson,
      ),
    );

    return ended;
  }

  refused(outcome: RunOutcome): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is ${this.state}. It cannot be refused.`,
      );
    }

    const ended = this.endedQueued(outcome);

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
        ended.askedAPerson,
      ),
    );

    return ended;
  }

  claimableAt(now: Date): boolean {
    return this.requeueCount.claimableAt(now);
  }

  requeue(by: RunnerId, now: Date, because: string): Run {
    this.requireClaimedBy(by, 'requeue');

    if (this.stopRequested) {
      return this.endedUnstarted(RunOutcome.stopped(-1));
    }

    const requeueCount = this.requeueCount.requeuedAt(now);

    if (requeueCount.exhausted) {
      return this.endedUnstarted(
        RunOutcome.unanswered(because, requeueCount.count),
      );
    }

    return this.with({
      state: 'queued',
      claimedBy: null,
      leaseExpiresAt: null,
      reservation: null,
      ranIn: null,
      startedAt: null,
      requeueCount,
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
        ended.askedAPerson,
      ),
    );

    return ended;
  }

  deniedStart(by: RunnerId, reason: string): Run {
    this.requireClaimedBy(by, 'deny the start of');

    return this.endedUnstarted(RunOutcome.refused([{ description: reason }]));
  }

  cancel(now: Date): Run {
    switch (this.state) {
      case 'queued':
        return this.cancelQueued(CANCELLED_QUEUED);
      case 'claimed':
        return this.requestStop(now);
      case 'waiting':
      case 'suspended':
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
        ended.askedAPerson,
      ),
    );

    return ended;
  }

  cancelQueued(reason: string): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is ${this.state}. It cannot be cancelled.`,
      );
    }

    const outcome = RunOutcome.cancelled(reason);
    const cancelled = this.endedQueued(outcome);

    cancelled.record(
      new RunCancelled(
        this.id,
        this.workspaceId,
        this.subject,
        this.attempt,
        this.askedAPerson,
      ),
    );

    return cancelled;
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
    if (
      !this.hasEnded ||
      !this.outcome?.failed ||
      this.outcome.superseded ||
      this.outcome.cancelled
    ) {
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
    if (this.state === 'suspended') {
      return this.endedUnstarted(RunOutcome.stopped(-1));
    }

    if (!isLeased(this.state)) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is ${this.state}. It cannot be stopped.`,
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

  wasClaimedBy(runner: RunnerId): boolean {
    return this.claimedBy?.equals(runner) ?? false;
  }

  assertLeasedBy(by: RunnerId): void {
    this.requireLeasedBy(by, 'act on');
  }

  journalFor(by: RunnerId): RunAttempt {
    this.requireLeasedBy(by, 'journal');

    return this.currentAttempt;
  }

  get currentAttempt(): RunAttempt {
    return RunAttempt.of(this.id, this.attempt);
  }

  assertStillOn(attempt: RunAttempt, by: RunnerId): void {
    if (!this.isLeasedBy(by) || !attempt.equals(this.currentAttempt)) {
      throw new RunAttemptOverError(this.id.value, attempt.number);
    }
  }

  get injectsSecrets(): boolean {
    return (
      this.spec.injectedSecrets.length > 0 || this.spec.injectsSpotlightApi
    );
  }

  isLeasedBy(runner: RunnerId): boolean {
    return isLeased(this.state) && this.wasClaimedBy(runner);
  }

  attemptClaimedBy(runner: RunnerId): RunAttempt | null {
    return this.wasClaimedBy(runner) ? this.currentAttempt : null;
  }

  injectedSecretsFor(runner: RunnerId): readonly SecretName[] {
    return this.isLeasedBy(runner) ? this.spec.injectedSecrets : [];
  }

  usesSpotlightApiFor(runner: RunnerId): boolean {
    return this.isLeasedBy(runner) && this.spec.injectsSpotlightApi;
  }

  isEnabled(tool: Tool): boolean {
    return this.spec.enables(tool);
  }

  pinnedFor(tool: Tool): Tool | null {
    return this.spec.pinned(tool);
  }

  leaseExpired(now: Date): boolean {
    return (
      isLeased(this.state) &&
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
    requeueCount?: RequeueCount;
    spec?: RunSpec;
    suspendedAttempts?: readonly number[];
    startedAt?: Date | null;
    startedFrom?: StartingPoint | null;
    askedAPerson?: boolean;
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
      part.requeueCount ?? this.requeueCount,
      this.briefedWith,
      part.suspendedAttempts ?? this.suspendedAttempts,
      this.configuredAs,
      part.startedAt !== undefined ? part.startedAt : this.startedAt,
      part.startedFrom !== undefined ? part.startedFrom : this.startedFrom,
      part.askedAPerson ?? this.askedAPerson,
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

  private requireClaimedBy(by: RunnerId, action: string): void {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `Cannot ${action} run ${this.id.value} while it is ${this.state}.`,
      );
    }

    this.requireLeasedBy(by, action);
  }

  private requireLeasedBy(by: RunnerId, action: string): void {
    if (!isLeased(this.state)) {
      throw new InvalidRunTransitionError(
        `Cannot ${action} run ${this.id.value} while it is ${this.state}.`,
      );
    }
    if (!this.claimedBy?.equals(by)) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is claimed by runner ${this.claimedBy?.value ?? 'none'}.`,
      );
    }
  }
}
