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
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunCancelled } from '@work/domain/events/run-cancelled.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@work/domain/events/run-lease-expired.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import { RunSuspended } from '@work/domain/events/run-suspended.event';
import { InvalidRunOrderError } from '@work/domain/exceptions/invalid-run-order.error';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import { RunActsOnlyOnItselfError } from '@work/domain/exceptions/run-acts-only-on-itself.error';
import { RunAttemptOverError } from '@work/domain/exceptions/run-attempt-over.error';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RequeueCount } from '@work/domain/value-objects/requeue-count.vo';
import type { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import { RunApiGrant } from '@work/domain/value-objects/run-api-grant.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunExtensions } from '@work/domain/value-objects/run-extensions.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import type { RunPolicy } from '@work/domain/value-objects/run-policy.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { RunRequester } from '@work/domain/value-objects/run-requester.vo';
import {
  actsBeyondItselfIn,
  type RunCheckout,
  type RunSpec,
} from '@work/domain/value-objects/run-spec.vo';
import {
  LEASED_RUN_STATES,
  type RunState,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import { RunTags } from '@work/domain/value-objects/run-tags.vo';
import { RunTurn } from '@work/domain/value-objects/run-turn.vo';
import type { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import {
  type ReportedStart,
  StartingPoint,
} from '@work/domain/value-objects/starting-point.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import type {
  RunWorkspace,
  WorkspaceKey,
} from '@work/domain/value-objects/workspace-key.vo';

const LEASE_DURATION_MS = 60_000;

export interface RunStart {
  readonly restored: RestoredArchive | null;
  readonly checkouts: readonly StartedCheckout[];
}

const LOST = RunFailure.of('runner-lost').retry;

const CANCELLED_QUEUED = 'Task moved on before a runner claimed the run.';

const endingIn = (outcome: RunOutcome): RunState =>
  outcome.cancelled ? 'cancelled' : outcome.failed ? 'failed' : 'completed';

const isLeased = (state: RunState): boolean =>
  (LEASED_RUN_STATES as readonly RunState[]).includes(state);

export interface RunOrdered {
  readonly requester: RunRequester;
  readonly policy: RunPolicy;
  readonly workspace: RunWorkspace | null;
  readonly restore: WorkspaceArchiveId | null;
  readonly extensions: RunExtensions;
  readonly tags: RunTags;
  readonly apiGrant: RunApiGrant | null;
}

export interface RestoreCandidate {
  readonly id: WorkspaceArchiveId;
  readonly workspaceKey: WorkspaceKey;
  readonly completedAt: Date | null;
  isAvailableIn(workspaceId: WorkspaceId): boolean;
}

export type RestoreSource =
  | { readonly archive: WorkspaceArchiveId }
  | { readonly newestOf: WorkspaceKey };

const orderProblem = (ordered: RunOrdered, spec: RunSpec): string | null => {
  const { requester, policy, workspace, apiGrant } = ordered;

  if (workspace && !workspace.key.owner.equals(requester.owner)) {
    return `names workspace ${workspace.key.value}, which belongs to another requester than ${requester.owner.value}`;
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
    readonly attempt: number,
    readonly stopRequestedAt: Date | null,
    readonly reservation: RunnerReservation | null,
    readonly provisioning: Provisioning,
    readonly ranIn: RunnerImage | null,
    readonly requeueCount: RequeueCount,
    readonly suspendedAttempts: readonly number[] = [],
    readonly startedAt: Date | null = null,
    readonly startedFrom: StartingPoint | null = null,
    readonly askedAPerson: boolean = false,
    readonly version: number = 0,
    readonly orderFingerprint: string | null = null,
    readonly turn: RunTurn | null = null,
    readonly endedAt: Date | null = null,
    readonly queuedAt: Date | null = null,
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
    workspace?: RunWorkspace | null;
    restore?: WorkspaceArchiveId | null;
    extensions?: RunExtensions;
    tags?: RunTags;
    apiGrant?: RunApiGrant | null;
    spec: RunSpec;
    placement?: RunnerPlacement;
    orderFingerprint?: string | null;
    queuedAt?: Date;
  }): Run {
    const ordered = Run.orderedFrom(input);
    const problem = orderProblem(ordered, input.spec);

    if (problem) {
      throw new InvalidRunOrderError(problem);
    }

    return new Run(
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
      1,
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
      input.queuedAt ?? null,
    );
  }

  private static orderedFrom(input: {
    requester: RunRequester;
    policy: RunPolicy;
    workspace?: RunWorkspace | null;
    restore?: WorkspaceArchiveId | null;
    extensions?: RunExtensions;
    tags?: RunTags;
    apiGrant?: RunApiGrant | null;
  }): RunOrdered {
    return {
      requester: input.requester,
      policy: input.policy,
      workspace: input.workspace ?? null,
      restore: input.restore ?? null,
      extensions: input.extensions ?? RunExtensions.none(),
      tags: input.tags ?? RunTags.none(),
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
    workspace?: RunWorkspace | null;
    restore?: WorkspaceArchiveId | null;
    extensions?: RunExtensions;
    tags?: RunTags;
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
    version?: number;
    orderFingerprint?: string | null;
    turn?: RunTurn | null;
    endedAt?: Date | null;
    queuedAt?: Date | null;
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
      input.attempt,
      input.stopRequestedAt ?? null,
      input.reservation,
      input.provisioning,
      input.ranIn ?? null,
      input.requeueCount ?? RequeueCount.none(),
      [...(input.suspendedAttempts ?? [])],
      input.startedAt ?? null,
      input.startedFrom ?? null,
      input.askedAPerson ?? false,
      input.version ?? 0,
      input.orderFingerprint ?? null,
      input.turn ?? null,
      input.endedAt ?? null,
      input.queuedAt ?? null,
    );
  }

  private static guardReconstituted(input: {
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    attempt: number;
    ordered: RunOrdered;
    spec: RunSpec;
    startedFrom?: StartingPoint | null;
    askedAPerson?: boolean;
    turn?: RunTurn | null;
  }): void {
    if (input.attempt < 1) {
      throw new InconsistentStateError('run', 'has no attempt to its name');
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

  get workspace(): RunWorkspace | null {
    return this.ordered.workspace;
  }

  get restore(): WorkspaceArchiveId | null {
    return this.ordered.restore;
  }

  get extensions(): RunExtensions {
    return this.ordered.extensions;
  }

  get tags(): RunTags {
    return this.ordered.tags;
  }

  get apiGrant(): RunApiGrant | null {
    return this.ordered.apiGrant;
  }

  get workspaceKey(): WorkspaceKey | null {
    return this.ordered.workspace?.key ?? null;
  }

  get sandboxIsRejoinable(): boolean {
    return this.ordered.workspace?.rejoinable ?? false;
  }

  get restoresFrom(): RestoreSource | null {
    if (this.ordered.restore) {
      return { archive: this.ordered.restore };
    }

    const workspace = this.ordered.workspace;

    return workspace?.restoresWhen(this.spec.continuesASession)
      ? { newestOf: workspace.key }
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
        .filter((each) => each.workspaceKey.equals(source.newestOf))
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
      : archive.workspaceKey.equals(source.newestOf);
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
        this.requester,
        outcome,
        null,
        null,
        null,
        this.attempt,
        failed.askedAPerson,
        this.hasStarted,
        false,
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
    const next = this.stopRequested
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
        this.requester,
        this.attempt,
        this.expiredLeases,
        this.askedAPerson,
        outcome.failure?.code ?? null,
        this.hasStarted,
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

    if (this.stopRequested) {
      return this.endedAsStopped(by);
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
    });

    ended.record(
      new RunCompleted(
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

    return this.askedAPerson ? this : this.with({ askedAPerson: true });
  }

  reportTurn(
    by: RunnerId,
    outcome: RunOutcome,
    report: HandoverReport,
    now: Date,
  ): Run {
    if (!this.policy.holdsTurn || !outcome.handsOver) {
      return this.complete(by, outcome, report);
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
      new RunSuspended(this.id, this.workspaceId, by, now, this.attempt),
    );

    return suspended;
  }

  turnAt(attempt: number): RunTurn | null {
    return this.state === 'suspended' && this.attempt === attempt
      ? this.turn
      : null;
  }

  keep(attempt: number): Run {
    const turn = this.turnAt(attempt);

    if (!turn?.pending) {
      return this;
    }

    if (this.stopRequested) {
      return this.endedUnstarted(RunOutcome.stopped(-1));
    }

    const kept = this.with({ turn: turn.kept() });

    kept.record(this.paused(turn.suspendedAt, false));

    return kept;
  }

  resumed(
    attempt: number | null,
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
      return this.endedUnstarted(RunOutcome.stopped(-1));
    }

    const resumed = this.with({
      spec: this.spec.join(joining),
      turn: null,
    }).backOnTheQueue();

    if (because === 'messages') {
      resumed.record(this.paused(now, true));
    } else if (turn.pending) {
      resumed.record(this.paused(turn.suspendedAt, false));
    }

    return resumed;
  }

  finished(attempt: number): Run {
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
      new RunCompleted(
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

  get hasStarted(): boolean {
    return this.startedAt !== null || this.attempt > 1;
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
        this.requester,
        outcome,
        by,
        null,
        null,
        this.attempt,
        ended.askedAPerson,
        this.hasStarted,
        false,
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
        this.requester,
        outcome,
        null,
        null,
        null,
        this.attempt,
        ended.askedAPerson,
        this.hasStarted,
        false,
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
      turn: null,
    });

    ended.record(
      new RunCompleted(
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
      turn: null,
    });

    ended.record(
      new RunCompleted(
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
        this.requester,
        this.attempt,
        this.askedAPerson,
        this.hasStarted,
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

  requestStop(now: Date): Run {
    if (this.state === 'suspended' && this.turn?.pending) {
      return this.stopRequested ? this : this.with({ stopRequestedAt: now });
    }

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

    return this.with({ stopRequestedAt: now });
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
    return this.spec.injectedSecrets.length > 0 || this.apiGrant !== null;
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
    turn?: RunTurn | null;
    endedAt?: Date | null;
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
      this.queuedAt,
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
