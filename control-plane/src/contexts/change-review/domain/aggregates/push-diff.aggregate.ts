import { PushDiffLeaseReleased } from '@change-review/domain/events/push-diff-lease-released.event';
import { PushDiffRecorded } from '@change-review/domain/events/push-diff-recorded.event';
import { PushDiffReservationDropped } from '@change-review/domain/events/push-diff-reservation-dropped.event';
import { InvalidPushDiffError } from '@change-review/domain/exceptions/invalid-push-diff.error';
import { PushDiffNotLeasedError } from '@change-review/domain/exceptions/push-diff-not-leased.error';
import { PushDiffStateConflictError } from '@change-review/domain/exceptions/push-diff-state-conflict.error';
import type { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import type { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import {
  RunnerAssignment,
  waitExpiredSince,
} from '@change-review/domain/value-objects/runner-assignment.vo';
import type { RunnerClaim } from '@change-review/domain/value-objects/runner-claim.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import type { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PUSH_DIFF_STATUSES = [
  'waiting',
  'diffed',
  'failed',
  'superseded',
] as const;

export type PushDiffStatus = (typeof PUSH_DIFF_STATUSES)[number];

const MAX_FAILURE = 2_000;

const failureOf = (reason: string): string =>
  reason.trim().slice(0, MAX_FAILURE) || 'The runner gave no reason.';

export type PushSettlement =
  | 'stacked'
  | 'shown'
  | 'superseded'
  | 'task-gone'
  | { readonly refused: string };

const outcomeOf = (
  settlement: PushSettlement,
): { readonly status: PushDiffStatus; readonly failure: string | null } => {
  if (typeof settlement === 'object') {
    return { status: 'failed', failure: failureOf(settlement.refused) };
  }

  if (settlement === 'task-gone') {
    return { status: 'failed', failure: 'The task of the push is gone.' };
  }

  return {
    status:
      settlement === 'stacked' || settlement === 'shown'
        ? 'diffed'
        : 'superseded',
    failure: null,
  };
};

export interface Push {
  readonly head: CommitSha;
  readonly baseTip: CommitSha;
  readonly pushedBy: Pusher | null;
  readonly pushedAt: Date;
}

export class PushDiff extends EventRecorder {
  private constructor(
    readonly id: PushDiffId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId,
    readonly pullRequest: PullRequestUrl,
    readonly repository: RepositoryName,
    readonly push: Push,
    readonly placement: RunnerPlacement,
    readonly status: PushDiffStatus,
    readonly failure: string | null,
    readonly assignment: RunnerAssignment,
    readonly recordedAt: Date,
    readonly version: number,
  ) {
    super();
  }

  static record(input: {
    id: PushDiffId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    pullRequest: PullRequestUrl;
    push: Push;
    placement: RunnerPlacement;
    now: Date;
  }): PushDiff {
    const repository = RepositoryName.ofPullRequest(input.pullRequest);

    if (!repository) {
      throw new InvalidPushDiffError(
        'needs a pull request that names its repository',
      );
    }

    const recorded = new PushDiff(
      input.id,
      input.workspaceId,
      input.taskId,
      input.pullRequest,
      repository,
      input.push,
      input.placement,
      'waiting',
      null,
      RunnerAssignment.none(),
      input.now,
      0,
    );
    recorded.record(new PushDiffRecorded(input.id));

    return recorded;
  }

  static rehydrate(input: {
    id: PushDiffId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    pullRequest: PullRequestUrl;
    repository: RepositoryName;
    push: Push;
    placement: RunnerPlacement;
    status: PushDiffStatus;
    failure: string | null;
    claim: RunnerClaim;
    reservation: RunnerReservation | null;
    provisioning: Provisioning;
    recordedAt: Date;
    version: number;
  }): PushDiff {
    if ((input.status === 'failed') !== (input.failure !== null)) {
      throw new InconsistentStateError(
        'push diff',
        `is ${input.status} with ${input.failure === null ? 'no' : 'a'} failure`,
      );
    }

    if (!input.repository.isOf(input.pullRequest)) {
      throw new InconsistentStateError(
        'push diff',
        `is of repository ${input.repository.value}, not of its pull request`,
      );
    }

    const assignment = RunnerAssignment.of(input);

    if (input.status !== 'waiting' && assignment.holdsRunner) {
      throw new InconsistentStateError(
        'push diff',
        `is ${input.status}, yet still holds a runner`,
      );
    }

    return new PushDiff(
      input.id,
      input.workspaceId,
      input.taskId,
      input.pullRequest,
      input.repository,
      input.push,
      input.placement,
      input.status,
      input.failure,
      assignment,
      input.recordedAt,
      input.version,
    );
  }

  get claim(): RunnerClaim {
    return this.assignment.claim;
  }

  get reservation(): RunnerReservation | null {
    return this.assignment.reservation;
  }

  get provisioning(): Provisioning {
    return this.assignment.provisioning;
  }

  claimableAt(now: Date, by: RunnerId | null = null): boolean {
    return (
      this.status === 'waiting' &&
      !this.waitExpiredAt(now) &&
      this.assignment.claimableAt(now, by)
    );
  }

  claimableBy(runner: RunnerId, offer: RunnerOffer, now: Date): boolean {
    return this.claimableAt(now, runner) && this.placement.matches(offer);
  }

  claimedFor(runner: RunnerId, offer: RunnerOffer, now: Date): PushDiff {
    if (!this.claimableBy(runner, offer, now)) {
      throw new PushDiffStateConflictError(
        'is not waiting for a runner like this one to claim it',
      );
    }

    const unreserved = this.assignment.isReservedFor(runner)
      ? this
      : this.droppingReservation();

    return unreserved.with({
      assignment: unreserved.assignment.claimedBy(runner, now),
    });
  }

  beingDiffedBy(runner: RunnerId, now: Date): boolean {
    return this.status === 'waiting' && this.assignment.isLeasedBy(runner, now);
  }

  get settled(): boolean {
    return this.status !== 'waiting';
  }

  answerableBy(runner: RunnerId, now: Date): boolean {
    return this.settled || this.beingDiffedBy(runner, now);
  }

  renewedFor(runner: RunnerId, now: Date): PushDiff {
    this.assertDiffedBy(runner, now);

    return this.with({ assignment: this.assignment.renewed(now) });
  }

  unclaimedBy(runner: RunnerId, now: Date): PushDiff {
    this.assertDiffedBy(runner, now);

    return this.with({ assignment: this.assignment.unclaimed() });
  }

  settledBy(runner: RunnerId, settlement: PushSettlement, now: Date): PushDiff {
    if (this.settled) {
      return this;
    }
    this.assertDiffedBy(runner, now);

    return this.leaseReleased(
      this.with({
        ...outcomeOf(settlement),
        assignment: this.assignment.released(),
      }),
    );
  }

  failedFor(runner: RunnerId, reason: string, now: Date): PushDiff {
    if (this.settled) {
      return this;
    }
    this.assertDiffedBy(runner, now);

    const released = this.assignment.released();

    return this.leaseReleased(
      released.claim.exhausted
        ? this.with({
            status: 'failed',
            failure: failureOf(reason),
            assignment: released,
          })
        : this.with({ assignment: released }),
    );
  }

  supersededAt(now: Date): PushDiff {
    if (this.status !== 'waiting' || this.assignment.isLeasedAt(now)) {
      return this;
    }

    const dropped = this.droppingReservation();

    return dropped.with({
      status: 'superseded',
      assignment: dropped.assignment.released(),
    });
  }

  waitExpiredAt(now: Date): boolean {
    return (
      this.status === 'waiting' &&
      ((this.claim.exhausted && !this.assignment.isLeasedAt(now)) ||
        waitExpiredSince(this.recordedAt, this.claim, now))
    );
  }

  expireWait(now: Date): PushDiff {
    if (!this.waitExpiredAt(now)) {
      throw new PushDiffStateConflictError(
        'has not waited past its limit, so nobody failed to make it yet',
      );
    }

    const dropped = this.droppingReservation();

    return dropped.with({
      status: 'failed',
      assignment: dropped.assignment.released(),
      failure: this.claim.exhausted
        ? 'No runner finished making the diff.'
        : 'No runner made the diff in time.',
    });
  }

  delete(now: Date): PushDiff {
    const deleted = this.droppingReservation();

    return this.assignment.isLeasedAt(now)
      ? this.leaseReleased(
          deleted.with({ assignment: deleted.assignment.released() }),
        )
      : deleted;
  }

  isReservedAt(now: Date): boolean {
    return this.assignment.isReservedAt(now);
  }

  reservationExpiredAt(now: Date): boolean {
    return (
      this.status === 'waiting' && this.assignment.reservationExpiredAt(now)
    );
  }

  provisionableAt(now: Date): boolean {
    return (
      this.status === 'waiting' &&
      !this.waitExpiredAt(now) &&
      this.assignment.provisionableAt(now)
    );
  }

  reservedFor(runner: RunnerId, pool: PoolId, now: Date): PushDiff {
    if (!this.provisionableAt(now)) {
      throw new PushDiffStateConflictError(
        'cannot be reserved for a runner to be provisioned while it is not waiting for one',
      );
    }

    return this.with({
      assignment: this.assignment.reservedFor(runner, pool, now),
    });
  }

  unreservedFor(runner: RunnerId): PushDiff {
    return this.assignment.isReservedFor(runner)
      ? this.droppingReservation()
      : this;
  }

  provisionFailed(
    runner: RunnerId,
    failure: ProvisionFailure,
    now: Date,
  ): PushDiff {
    if (!this.assignment.takesProvisionFailureFrom(runner, now)) {
      return this;
    }

    const dropped = this.droppingReservation();
    const failed = dropped.with({
      assignment: dropped.assignment.provisionFailedAt(failure, now),
    });

    return failed.provisioning.exhausted
      ? failed.with({
          status: 'failed',
          failure: 'No runner could be provisioned to make the diff.',
          assignment: failed.assignment.released(),
        })
      : failed;
  }

  private droppingReservation(): PushDiff {
    const { reservation } = this.assignment;

    if (!reservation) {
      return this;
    }

    const dropped = this.with({
      assignment: this.assignment.withoutReservation(),
    });
    dropped.record(new PushDiffReservationDropped(this.id, reservation.runner));

    return dropped;
  }

  private leaseReleased(next: PushDiff): PushDiff {
    next.record(new PushDiffLeaseReleased(this.id));

    return next;
  }

  private assertDiffedBy(runner: RunnerId, now: Date): void {
    if (!this.beingDiffedBy(runner, now)) {
      throw new PushDiffNotLeasedError(this.id);
    }
  }

  private with(change: {
    status?: PushDiffStatus;
    failure?: string | null;
    assignment?: RunnerAssignment;
  }): PushDiff {
    const next = new PushDiff(
      this.id,
      this.workspaceId,
      this.taskId,
      this.pullRequest,
      this.repository,
      this.push,
      this.placement,
      change.status ?? this.status,
      change.failure === undefined ? this.failure : change.failure,
      change.assignment ?? this.assignment,
      this.recordedAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
