import { RunAskedAPerson } from '@runs/domain/events/run-asked-a-person.event';
import { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import { RunClaimed } from '@runs/domain/events/run-claimed.event';
import { RunEnded, type RunEnding } from '@runs/domain/events/run-ended.event';
import { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@runs/domain/events/run-lease-expired.event';
import { RunPaused } from '@runs/domain/events/run-paused.event';
import { RunProvisionFailed } from '@runs/domain/events/run-provision-failed.event';
import { RunRequeued } from '@runs/domain/events/run-requeued.event';
import { RunReservationDropped } from '@runs/domain/events/run-reservation-dropped.event';
import { RunReserved } from '@runs/domain/events/run-reserved.event';
import { RunResumed } from '@runs/domain/events/run-resumed.event';
import { RunStarted } from '@runs/domain/events/run-started.event';
import { RunStartingPointRecorded } from '@runs/domain/events/run-starting-point-recorded.event';
import { RunStopRequested } from '@runs/domain/events/run-stop-requested.event';
import { RunSuspended } from '@runs/domain/events/run-suspended.event';
import { RunUnclaimed } from '@runs/domain/events/run-unclaimed.event';
import { InvalidRunOrderError } from '@runs/domain/exceptions/invalid-run-order.error';
import { InvalidRunTransitionError } from '@runs/domain/exceptions/invalid-run-transition.error';
import { InvalidStartingPointError } from '@runs/domain/exceptions/invalid-starting-point.error';
import { RunActsOnlyOnItselfError } from '@runs/domain/exceptions/run-acts-only-on-itself.error';
import { RunAttemptOverError } from '@runs/domain/exceptions/run-attempt-over.error';
import { RunOrderConflictError } from '@runs/domain/exceptions/run-order-conflict.error';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { RequeueCount } from '@runs/domain/value-objects/requeue-count.vo';
import type { RestoredArchive } from '@runs/domain/value-objects/restored-archive.vo';
import { RunApiGrant } from '@runs/domain/value-objects/run-api-grant.vo';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunExtensions } from '@runs/domain/value-objects/run-extensions.vo';
import { RunFailure } from '@runs/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import type { RunPolicy } from '@runs/domain/value-objects/run-policy.vo';
import { RunPriority } from '@runs/domain/value-objects/run-priority.vo';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import {
  actsBeyondItselfIn,
  type RunCheckout,
  type RunSpec,
} from '@runs/domain/value-objects/run-spec.vo';
import {
  LEASED_RUN_STATES,
  type RunState,
  TERMINAL_RUN_STATES,
} from '@runs/domain/value-objects/run-state';
import { RunTags } from '@runs/domain/value-objects/run-tags.vo';
import { RunTurn } from '@runs/domain/value-objects/run-turn.vo';
import type { StartedCheckout } from '@runs/domain/value-objects/started-checkout.vo';
import {
  type ReportedStart,
  StartingPoint,
} from '@runs/domain/value-objects/starting-point.vo';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type {
  RunWorkingCopy,
  WorkingCopyKey,
} from '@runs/domain/value-objects/working-copy-key.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const LEASE_DURATION_MS = 60_000;

export interface RunStart {
  readonly restored: RestoredArchive | null;
  readonly checkouts: readonly StartedCheckout[];
}

const LOST = RunFailure.of('runner-lost').retry;

const endingIn = (outcome: RunOutcome): RunState =>
  outcome.cancelled ? 'cancelled' : outcome.failed ? 'failed' : 'completed';

const isLeased = (state: RunState): boolean =>
  (LEASED_RUN_STATES as readonly RunState[]).includes(state);

export interface RunClaimer {
  readonly runner: RunnerId;
  readonly workspaceId: WorkspaceId;
}

type StateWhenCancelled = 'queued' | 'claimed' | 'suspended' | 'ended';

export interface CancelledRun {
  readonly run: Run;
  readonly was: StateWhenCancelled;
  readonly started: boolean;
}

export type QueuedCancellation =
  | {
      readonly run: Run;
      readonly outcome: 'cancelled';
      readonly started: boolean;
    }
  | { readonly run: Run; readonly outcome: 'claimed' | 'ended' };

export interface RunOrdered {
  readonly requester: RunRequester;
  readonly policy: RunPolicy;
  readonly workingCopy: RunWorkingCopy | null;
  readonly restore: WorkingCopyArchiveId | null;
  readonly extensions: RunExtensions;
  readonly tags: RunTags;
  readonly line: LineId | null;
  readonly apiGrant: RunApiGrant | null;
}

interface RestoreCandidate {
  readonly id: WorkingCopyArchiveId;
  readonly workingCopyKey: WorkingCopyKey;
  readonly completedAt: Date | null;
  isAvailableIn(workspaceId: WorkspaceId): boolean;
}

type RestoreSource =
  | { readonly archive: WorkingCopyArchiveId }
  | { readonly newestOf: WorkingCopyKey };

const orderProblem = (ordered: RunOrdered, spec: RunSpec): string | null => {
  const { requester, policy, workingCopy, apiGrant } = ordered;

  if (workingCopy && !workingCopy.key.owner.equals(requester.owner)) {
    return `names working copy ${workingCopy.key.value}, which belongs to another requester than ${requester.owner.value}`;
  }

  if ((apiGrant !== null) !== spec.injectsSpotlightApi) {
    return 'must grant Spotlight’s API exactly when its spec uses it';
  }

  const beyond = policy.actsBeyondItself
    ? null
    : actsBeyondItselfIn(spec.value);

  return beyond ? `acts only on itself, yet ${beyond}` : null;
};

export class Run extends EventRecorder {
  private constructor(
    readonly id: RunId,
    readonly workspaceId: WorkspaceId,
    readonly harness: HarnessId,
    readonly priority: RunPriority,
    readonly ordered: RunOrdered,
    readonly spec: RunSpec,
    readonly placement: RunnerPlacement,
    readonly state: RunState,
    readonly claimedBy: RunnerId | null,
    readonly leaseExpiresAt: Date | null,
    readonly outcome: RunOutcome | null,
    readonly attempt: RunAttempt,
    readonly stopRequestedAt: Date | null,
    readonly reservation: RunnerReservation | null,
    readonly provisioning: Provisioning,
    readonly ranIn: RunnerImage | null,
    readonly requeueCount: RequeueCount,
    readonly suspendedAttempts: readonly RunAttempt[] = [],
    readonly startedAt: Date | null = null,
    readonly startedFrom: StartingPoint | null = null,
    readonly askedAPerson: boolean = false,
    readonly version: number = 0,
    readonly orderFingerprint: string | null = null,
    readonly turn: RunTurn | null = null,
    readonly endedAt: Date | null = null,
    readonly queuedAt: Date,
    readonly createdAt: Date,
  ) {
    super();
  }

  static enqueue(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority?: RunPriority;
    requester: RunRequester;
    policy: RunPolicy;
    workingCopy?: RunWorkingCopy | null;
    restore?: WorkingCopyArchiveId | null;
    extensions?: RunExtensions;
    tags?: RunTags;
    line?: LineId | null;
    apiGrant?: RunApiGrant | null;
    spec: RunSpec;
    placement?: RunnerPlacement;
    orderFingerprint?: string | null;
    refusal?: readonly { readonly description: string }[] | null;
    now: Date;
  }): Run {
    const ordered = Run.orderedFrom(input);
    const problem = orderProblem(ordered, input.spec);

    if (problem) {
      throw new InvalidRunOrderError(problem);
    }

    const queued = new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority ?? RunPriority.normal,
      ordered,
      input.spec,
      input.placement ?? RunnerPlacement.anywhere(),
      'queued',
      null,
      null,
      null,
      RunAttempt.first(input.id),
      null,
      null,
      Provisioning.none(),
      null,
      RequeueCount.none(),
      [],
      null,
      null,
      false,
      0,
      input.orderFingerprint ?? null,
      null,
      null,
      input.now,
      input.now,
    );

    return input.refusal
      ? queued.refused(RunOutcome.refused(input.refusal), input.now)
      : queued;
  }

  reordered(fingerprint: string): Run {
    if (this.orderFingerprint !== fingerprint) {
      throw new RunOrderConflictError(this.id.value);
    }

    return this;
  }

  private static orderedFrom(input: {
    requester: RunRequester;
    policy: RunPolicy;
    workingCopy?: RunWorkingCopy | null;
    restore?: WorkingCopyArchiveId | null;
    extensions?: RunExtensions;
    tags?: RunTags;
    line?: LineId | null;
    apiGrant?: RunApiGrant | null;
  }): RunOrdered {
    return {
      requester: input.requester,
      policy: input.policy,
      workingCopy: input.workingCopy ?? null,
      restore: input.restore ?? null,
      extensions: input.extensions ?? RunExtensions.none(),
      tags: input.tags ?? RunTags.none(),
      line: input.line ?? null,
      apiGrant: input.apiGrant ?? null,
    };
  }

  static rehydrate(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority: RunPriority;
    requester: RunRequester;
    policy: RunPolicy;
    workingCopy?: RunWorkingCopy | null;
    restore?: WorkingCopyArchiveId | null;
    extensions?: RunExtensions;
    tags?: RunTags;
    line?: LineId | null;
    apiGrant?: RunApiGrant | null;
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
    suspendedAttempts?: readonly number[];
    startedAt?: Date | null;
    startedFrom?: StartingPoint | null;
    askedAPerson?: boolean;
    version: number;
    orderFingerprint?: string | null;
    turn?: RunTurn | null;
    endedAt?: Date | null;
    queuedAt: Date;
    createdAt: Date;
  }): Run {
    const ordered = Run.orderedFrom(input);

    Run.guardReconstituted({ ...input, ordered });

    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority,
      ordered,
      input.spec,
      input.placement ?? RunnerPlacement.anywhere(),
      input.state,
      input.claimedBy,
      input.leaseExpiresAt,
      input.outcome,
      RunAttempt.of(input.id, input.attempt),
      input.stopRequestedAt ?? null,
      input.reservation,
      input.provisioning,
      input.ranIn ?? null,
      input.requeueCount ?? RequeueCount.none(),
      (input.suspendedAttempts ?? []).map((each) =>
        RunAttempt.of(input.id, each),
      ),
      input.startedAt ?? null,
      input.startedFrom ?? null,
      input.askedAPerson ?? false,
      input.version,
      input.orderFingerprint ?? null,
      input.turn ?? null,
      input.endedAt ?? null,
      input.queuedAt,
      input.createdAt,
    );
  }

  private static guardReconstituted(input: {
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    attempt: number;
    ordered: RunOrdered;
    spec: RunSpec;
    outcome: RunOutcome | null;
    reservation: RunnerReservation | null;
    stopRequestedAt?: Date | null;
    startedFrom?: StartingPoint | null;
    askedAPerson?: boolean;
    turn?: RunTurn | null;
    endedAt?: Date | null;
    version: number;
  }): void {
    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      throw new InconsistentStateError('run', 'has no attempt to its name');
    }
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError('run', `has version ${input.version}`);
    }
    const ended = (TERMINAL_RUN_STATES as readonly RunState[]).includes(
      input.state,
    );

    if (ended !== Boolean(input.endedAt)) {
      throw new InconsistentStateError(
        'run',
        'has an end time exactly when it has ended',
      );
    }
    if (ended && (!input.outcome || endingIn(input.outcome) !== input.state)) {
      throw new InconsistentStateError(
        'run',
        `is ${input.state} without an outcome that ends it so`,
      );
    }
    if ((input.state === 'queued' || isLeased(input.state)) && input.outcome) {
      throw new InconsistentStateError(
        'run',
        `is ${input.state} yet has an outcome`,
      );
    }
    if (
      input.state === 'suspended' &&
      (!input.outcome?.handsOver || !input.ordered.policy.holdsTurn)
    ) {
      throw new InconsistentStateError(
        'run',
        'is suspended without a hand-over its requester takes',
      );
    }
    if (input.reservation && input.state !== 'queued') {
      throw new InconsistentStateError(
        'run',
        `is ${input.state} yet still reserved for a runner`,
      );
    }
    if (input.turn && !input.turn.pending && input.stopRequestedAt) {
      throw new InconsistentStateError(
        'run',
        'keeps its turn though a person asked it to stop',
      );
    }
    if ((input.state === 'suspended') !== Boolean(input.turn)) {
      throw new InconsistentStateError(
        'run',
        'holds a turn only while it is suspended, and always then',
      );
    }
    const problem = orderProblem(input.ordered, input.spec);

    if (problem) {
      throw new InconsistentStateError('run', problem);
    }
    if (input.askedAPerson && input.ordered.policy.asks !== 'recorded') {
      throw new InconsistentStateError(
        'run',
        'recorded that it asked a person though its requester takes its asks',
      );
    }
    if (input.startedFrom && !input.spec.reportsStartingPoint) {
      throw new InconsistentStateError(
        'run',
        'started from somewhere though it reports no starting point',
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

  get requester(): RunRequester {
    return this.ordered.requester;
  }

  get policy(): RunPolicy {
    return this.ordered.policy;
  }

  get team(): TeamId | null {
    return this.ordered.requester.team;
  }

  get workingCopy(): RunWorkingCopy | null {
    return this.ordered.workingCopy;
  }

  get restore(): WorkingCopyArchiveId | null {
    return this.ordered.restore;
  }

  get extensions(): RunExtensions {
    return this.ordered.extensions;
  }

  get tags(): RunTags {
    return this.ordered.tags;
  }

  get line(): LineId | null {
    return this.ordered.line;
  }

  get apiGrant(): RunApiGrant | null {
    return this.ordered.apiGrant;
  }

  get workingCopyKey(): WorkingCopyKey | null {
    return this.ordered.workingCopy?.key ?? null;
  }

  get sandboxIsRejoinable(): boolean {
    return this.ordered.workingCopy?.rejoinable ?? false;
  }

  get restoresFrom(): RestoreSource | null {
    if (this.ordered.restore) {
      return { archive: this.ordered.restore };
    }

    const workingCopy = this.ordered.workingCopy;

    return workingCopy?.restoresWhen(this.spec.continuesASession)
      ? { newestOf: workingCopy.key }
      : null;
  }

  archiveToRestore<A extends RestoreCandidate>(
    candidates: readonly A[],
  ): A | null {
    const source = this.restoresFrom;

    if (!source) {
      return null;
    }

    const available = candidates.filter((each) =>
      each.isAvailableIn(this.workspaceId),
    );

    if ('archive' in source) {
      return available.find((each) => each.id.equals(source.archive)) ?? null;
    }

    return (
      available
        .filter((each) => each.workingCopyKey.equals(source.newestOf))
        .sort(
          (a, b) =>
            (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
        )[0] ?? null
    );
  }

  restored(archive: RestoredArchive): boolean {
    const source = this.restoresFrom;

    if (!source || !archive.workspaceId.equals(this.workspaceId)) {
      return false;
    }

    return 'archive' in source
      ? archive.id.equals(source.archive)
      : archive.workingCopyKey.equals(source.newestOf);
  }

  claim(claimer: RunClaimer, now: Date): Run {
    const by = claimer.runner;

    if (!claimer.workspaceId.equals(this.workspaceId)) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is queued in another workspace than its claimant's.`,
      );
    }
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is ${this.state}. It cannot be claimed.`,
      );
    }
    if (!this.claimableAt(now)) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} waits before a runner can claim it again.`,
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

    claimed.record(new RunClaimed(this.id, this.workspaceId, by));

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

    const reserved = this.with({
      reservation: RunnerReservation.from(runner, pool, now),
    });

    reserved.record(new RunReserved(this.id, this.workspaceId, runner, pool));

    return reserved;
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
    const failed = new RunProvisionFailed(
      this.id,
      this.workspaceId,
      this.attempt,
      failure.kind,
      failure.detail,
      now,
    );

    if (!provisioning.exhausted) {
      const retried = this.with({ reservation: null, provisioning });
      retried.record(failed);
      retried.recordReservationDropped(runner);

      return retried;
    }

    const outcome = RunOutcome.unprovisioned(failure, provisioning.attempts);
    const ended = this.with({
      state: endingIn(outcome),
      reservation: null,
      provisioning,
      outcome,
      endedAt: now,
    });

    ended.record(failed);
    ended.recordReservationDropped(runner);

    ended.record(
      new RunEnded(
        this.id,
        this.workspaceId,
        this.requester,
        outcome,
        null,
        null,
        null,
        this.attempt,
        ended.askedAPerson,
        this.hasStarted,
        false,
        now,
        'provision-failure',
      ),
    );

    return ended;
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
    const next = this.stopRequested
      ? this.endedAsStopped(null, now)
      : LOST.exhaustedAfter(this.expiredLeases) || this.askedAPerson
        ? this.exhaust(outcome(this.expiredLeases), now)
        : this.backOnTheQueue(now);

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
    return this.attempt.number - this.suspendedAttempts.length;
  }

  private exhaust(outcome: RunOutcome, now: Date): Run {
    const exhausted = this.with({
      state: endingIn(outcome),
      claimedBy: null,
      leaseExpiresAt: null,
      outcome,
      endedAt: now,
    });

    exhausted.record(
      new RunExhausted(
        this.id,
        this.workspaceId,
        this.requester,
        this.attempt,
        this.expiredLeases,
        this.askedAPerson,
        outcome.failure?.code ?? null,
        this.hasStarted,
        now,
      ),
    );

    return exhausted;
  }

  private backOnTheQueue(now: Date): Run {
    return this.with({
      state: 'queued',
      queuedAt: now,
      outcome: null,
      claimedBy: null,
      leaseExpiresAt: null,
      attempt: this.attempt.next(),
      reservation: null,
      provisioning: Provisioning.none(),
      ranIn: null,
      startedAt: null,
      requeueCount: RequeueCount.none(),
    });
  }

  unclaimedBy(by: RunnerId, now: Date): Run {
    this.requireClaimedBy(by, 'unclaim');

    if (this.ranIn) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} has started. It cannot be unclaimed.`,
      );
    }

    if (this.stopRequested) {
      return this.endedAsStopped(by, now);
    }

    const unclaimed = this.with({
      state: 'queued',
      queuedAt: now,
      claimedBy: null,
      leaseExpiresAt: null,
      startedAt: null,
    });

    unclaimed.record(new RunUnclaimed(this.id, this.workspaceId, by));

    return unclaimed;
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

    if (this.ranIn?.equals(image)) {
      return this;
    }

    const started = this.with({
      ranIn: image,
      startedAt: this.startedAt ?? now,
    });

    started.record(new RunStarted(this.id, this.workspaceId, by));

    return started;
  }

  startsFrom(
    attempt: RunAttempt,
    by: RunnerId,
    started: RunStart,
    now: Date,
  ): Run {
    this.assertStillOn(attempt, by);
    this.requireClaimedBy(by, 'record the start of');

    if (!this.spec.reportsStartingPoint) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} reports no starting point.`,
      );
    }

    const { restored } = started;

    if (restored && !this.restored(restored)) {
      throw new InvalidStartingPointError(
        `names archive ${restored.id.value}, which run ${this.id.value} did not restore`,
      );
    }

    const reported: ReportedStart = {
      archive: restored?.id ?? null,
      checkouts: started.checkouts,
    };

    if (this.startedFrom) {
      if (this.startedFrom.attempt < this.attempt.number) {
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
      attempt: this.attempt.number,
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

    const recorded = this.with({ startedFrom: point });

    recorded.record(
      new RunStartingPointRecorded(this.id, this.workspaceId, by),
    );

    return recorded;
  }

  renewLease(by: RunnerId, now: Date): Run {
    this.requireLeasedBy(by, 'renew the lease on');

    return this.with({ leaseExpiresAt: this.leaseFrom(now) });
  }

  complete(
    by: RunnerId,
    outcome: RunOutcome,
    report: HandoverReport,
    now: Date,
  ): Run {
    this.requireLeasedBy(by, 'complete');

    const ended = this.with({
      state: endingIn(outcome),
      outcome,
      leaseExpiresAt: null,
      endedAt: now,
    });

    ended.record(
      new RunEnded(
        this.id,
        this.workspaceId,
        this.requester,
        outcome,
        by,
        report.handover ?? null,
        report.session ?? null,
        this.attempt,
        ended.askedAPerson,
        this.hasStarted,
        true,
        now,
        'turn',
      ),
    );

    return ended;
  }

  mayActBeyondItself(what: string): void {
    if (!this.policy.actsBeyondItself) {
      throw new RunActsOnlyOnItselfError(what);
    }
  }

  askedAPersonBy(by: RunnerId): Run {
    this.requireClaimedBy(by, 'ask a person on');

    if (this.policy.asks !== 'recorded') {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} must ask a person through its requester.`,
      );
    }

    if (this.askedAPerson) {
      return this;
    }

    const asked = this.with({ askedAPerson: true });

    asked.record(new RunAskedAPerson(this.id, this.workspaceId, by));

    return asked;
  }

  reportTurn(
    by: RunnerId,
    outcome: RunOutcome,
    report: HandoverReport,
    now: Date,
  ): Run {
    if (!this.policy.holdsTurn || !outcome.handsOver) {
      return this.complete(by, outcome, report, now);
    }

    this.requireLeasedBy(by, 'hand over');

    const suspended = this.with({
      state: 'suspended',
      claimedBy: null,
      leaseExpiresAt: null,
      spec: this.spec.resumingIn(report.session),
      outcome,
      suspendedAttempts: [...this.suspendedAttempts, this.attempt],
      turn: RunTurn.pending(report, by, now),
    });

    suspended.record(
      new RunSuspended(
        this.id,
        this.workspaceId,
        this.requester,
        by,
        now,
        this.attempt,
      ),
    );

    return suspended;
  }

  turnAt(attempt: RunAttempt): RunTurn | null {
    return this.state === 'suspended' && this.attempt.equals(attempt)
      ? this.turn
      : null;
  }

  keep(attempt: RunAttempt, now: Date): Run {
    const turn = this.turnAt(attempt);

    if (!turn?.pending) {
      return this;
    }

    if (this.stopRequested) {
      return this.endedUnstarted(
        RunOutcome.stopped(ExitCode.notRun()),
        now,
        'stop',
      );
    }

    const kept = this.with({ turn: turn.kept() });

    kept.record(this.paused(turn.suspendedAt, false));

    return kept;
  }

  resumed(
    attempt: RunAttempt | null,
    because: 'messages' | 'answered',
    joining: readonly RunCheckout[],
    now: Date,
  ): Run {
    const turn = attempt === null ? this.turn : this.turnAt(attempt);

    if (this.state !== 'suspended' || !turn) {
      return this;
    }

    if (attempt === null && turn.pending) {
      return this;
    }

    if (this.stopRequested) {
      return this.endedUnstarted(
        RunOutcome.stopped(ExitCode.notRun()),
        now,
        'stop',
      );
    }

    const resumed = this.with({
      spec: this.spec.join(joining),
      turn: null,
    }).backOnTheQueue(now);

    resumed.record(new RunResumed(this.id, this.workspaceId));

    if (because === 'messages') {
      resumed.record(this.paused(now, true));
    } else if (turn.pending) {
      resumed.record(this.paused(turn.suspendedAt, false));
    }

    return resumed;
  }

  finished(attempt: RunAttempt): Run {
    const turn = this.turnAt(attempt);

    if (!turn || !this.outcome) {
      return this;
    }

    const ended = this.with({
      state: endingIn(this.outcome),
      turn: null,
      endedAt: turn.suspendedAt,
    });

    ended.record(
      new RunEnded(
        this.id,
        this.workspaceId,
        this.requester,
        this.outcome,
        turn.reportedBy,
        null,
        null,
        this.attempt,
        ended.askedAPerson,
        this.hasStarted,
        false,
        turn.suspendedAt,
        'turn',
      ),
    );

    return ended;
  }

  private paused(at: Date, resumesAtOnce: boolean): RunPaused {
    return new RunPaused(
      this.id,
      this.workspaceId,
      this.attempt,
      at,
      resumesAtOnce,
    );
  }

  get takesFilesAtCompletion(): boolean {
    return !this.policy.holdsTurn;
  }

  get handsOverFiles(): boolean {
    return this.policy.actsBeyondItself;
  }

  get hasStarted(): boolean {
    return this.startedAt !== null || this.attempt.number > 1;
  }

  private endedAsStopped(by: RunnerId | null, now: Date): Run {
    const outcome = RunOutcome.stopped(
      by ? ExitCode.clean() : ExitCode.notRun(),
    );
    const ended = this.with({
      state: endingIn(outcome),
      leaseExpiresAt: null,
      outcome,
      endedAt: now,
    });

    ended.record(
      new RunEnded(
        this.id,
        this.workspaceId,
        this.requester,
        outcome,
        by,
        null,
        null,
        this.attempt,
        ended.askedAPerson,
        this.hasStarted,
        false,
        now,
        'stop',
      ),
    );

    return ended;
  }

  private refused(outcome: RunOutcome, now: Date): Run {
    const ended = this.endedQueued(outcome, now);

    ended.record(
      new RunEnded(
        this.id,
        this.workspaceId,
        this.requester,
        outcome,
        null,
        null,
        null,
        this.attempt,
        ended.askedAPerson,
        this.hasStarted,
        false,
        now,
        'refusal',
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
      return this.endedUnstarted(
        RunOutcome.stopped(ExitCode.notRun()),
        now,
        'stop',
      );
    }

    const requeueCount = this.requeueCount.requeuedAt(now);

    if (requeueCount.exhausted) {
      return this.endedUnstarted(
        RunOutcome.unanswered(because, requeueCount.count),
        now,
        'requeue-limit',
      );
    }

    const requeued = this.with({
      state: 'queued',
      queuedAt: now,
      claimedBy: null,
      leaseExpiresAt: null,
      reservation: null,
      ranIn: null,
      startedAt: null,
      requeueCount,
    });

    requeued.record(new RunRequeued(this.id, this.workspaceId, by));

    return requeued;
  }

  private endedUnstarted(
    outcome: RunOutcome,
    now: Date,
    endedBy: RunEnding,
  ): Run {
    const ended = this.with({
      state: endingIn(outcome),
      claimedBy: null,
      leaseExpiresAt: null,
      outcome,
      turn: null,
      endedAt: now,
    });

    ended.record(
      new RunEnded(
        this.id,
        this.workspaceId,
        this.requester,
        outcome,
        null,
        null,
        null,
        this.attempt,
        ended.askedAPerson,
        this.hasStarted,
        false,
        now,
        endedBy,
      ),
    );

    return ended;
  }

  deniedStart(by: RunnerId, reason: string, now: Date): Run {
    this.requireClaimedBy(by, 'deny the start of');

    return this.endedUnstarted(
      RunOutcome.refused([{ description: reason }]),
      now,
      'refusal',
    );
  }

  cancel(reason: string, now: Date): CancelledRun {
    const started = this.hasStarted;

    switch (this.state) {
      case 'queued':
        return { run: this.cancelQueued(reason, now), was: 'queued', started };
      case 'claimed':
        return { run: this.requestStop(now), was: 'claimed', started };
      case 'suspended':
        return { run: this.endedAsItPaused(now), was: 'suspended', started };
      default:
        return { run: this, was: 'ended', started };
    }
  }

  cancelledIfQueued(reason: string, now: Date): QueuedCancellation {
    if (this.hasEnded) {
      return { run: this, outcome: 'ended' };
    }

    if (this.state !== 'queued') {
      return { run: this, outcome: 'claimed' };
    }

    return {
      run: this.cancelQueued(reason, now),
      outcome: 'cancelled',
      started: this.hasStarted,
    };
  }

  private endedAsItPaused(now: Date): Run {
    const outcome =
      this.outcome ??
      RunOutcome.of({ exitCode: ExitCode.clean(), failed: false });
    const ended = this.with({
      state: endingIn(outcome),
      leaseExpiresAt: null,
      outcome,
      turn: null,
      endedAt: now,
    });

    ended.record(
      new RunEnded(
        this.id,
        this.workspaceId,
        this.requester,
        outcome,
        this.turn?.reportedBy ?? this.claimedBy,
        null,
        null,
        this.attempt,
        ended.askedAPerson,
        this.hasStarted,
        false,
        now,
        'cancellation',
      ),
    );

    return ended;
  }

  private cancelQueued(reason: string, now: Date): Run {
    const outcome = RunOutcome.cancelled(reason);
    const cancelled = this.endedQueued(outcome, now);

    cancelled.record(
      new RunCancelled(
        this.id,
        this.workspaceId,
        this.requester,
        this.attempt,
        this.askedAPerson,
        this.hasStarted,
        now,
      ),
    );

    return cancelled;
  }

  private endedQueued(outcome: RunOutcome, now: Date): Run {
    const ended = this.with({
      state: endingIn(outcome),
      outcome,
      reservation: null,
      endedAt: now,
    });

    if (this.reservation) {
      ended.recordReservationDropped(this.reservation.runner);
    }

    return ended;
  }

  requestStop(now: Date): Run {
    if (this.state === 'suspended' && this.turn?.pending) {
      return this.stopRequested ? this : this.stoppingAt(now);
    }

    if (this.state === 'suspended') {
      return this.endedUnstarted(
        RunOutcome.stopped(ExitCode.notRun()),
        now,
        'stop',
      );
    }

    if (!isLeased(this.state)) {
      throw new InvalidRunTransitionError(
        `Run ${this.id.value} is ${this.state}. It cannot be stopped.`,
      );
    }

    if (this.stopRequested) {
      return this;
    }

    return this.stoppingAt(now);
  }

  private stoppingAt(now: Date): Run {
    const stopping = this.with({ stopRequestedAt: now });

    stopping.record(new RunStopRequested(this.id, this.workspaceId));

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

    return this.attempt;
  }

  attemptNumbered(attempt: number): RunAttempt | null {
    return Number.isInteger(attempt) &&
      attempt >= 1 &&
      attempt <= this.attempt.number
      ? RunAttempt.of(this.id, attempt)
      : null;
  }

  assertStillOn(attempt: RunAttempt, by: RunnerId): void {
    if (!this.isStillOn(attempt, by)) {
      throw new RunAttemptOverError(this.id.value, attempt.number);
    }
  }

  isStillOn(attempt: RunAttempt, by: RunnerId): boolean {
    return this.isLeasedBy(by) && attempt.equals(this.attempt);
  }

  get injectsSecrets(): boolean {
    return this.spec.injectedSecrets.length > 0 || this.apiGrant !== null;
  }

  isLeasedBy(runner: RunnerId): boolean {
    return isLeased(this.state) && this.wasClaimedBy(runner);
  }

  attemptClaimedBy(runner: RunnerId): RunAttempt | null {
    return this.wasClaimedBy(runner) ? this.attempt : null;
  }

  injectedSecretsFor(runner: RunnerId): readonly SecretName[] {
    return this.isLeasedBy(runner) ? this.spec.injectedSecrets : [];
  }

  apiGrantFor(runner: RunnerId): RunApiGrant | null {
    return this.isLeasedBy(runner) ? this.apiGrant : null;
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
    attempt?: RunAttempt;
    stopRequestedAt?: Date | null;
    reservation?: RunnerReservation | null;
    provisioning?: Provisioning;
    ranIn?: RunnerImage | null;
    requeueCount?: RequeueCount;
    spec?: RunSpec;
    suspendedAttempts?: readonly RunAttempt[];
    startedAt?: Date | null;
    startedFrom?: StartingPoint | null;
    askedAPerson?: boolean;
    turn?: RunTurn | null;
    endedAt?: Date | null;
    queuedAt?: Date;
  }): Run {
    const next = new Run(
      this.id,
      this.workspaceId,
      this.harness,
      this.priority,
      this.ordered,
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
      part.suspendedAttempts ?? this.suspendedAttempts,
      part.startedAt !== undefined ? part.startedAt : this.startedAt,
      part.startedFrom !== undefined ? part.startedFrom : this.startedFrom,
      part.askedAPerson ?? this.askedAPerson,
      this.version,
      this.orderFingerprint,
      part.turn !== undefined ? part.turn : this.turn,
      part.endedAt !== undefined ? part.endedAt : this.endedAt,
      part.queuedAt ?? this.queuedAt,
      this.createdAt,
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
