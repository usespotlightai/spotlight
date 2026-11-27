import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { PushDiffLeaseReleased } from '@change-review/domain/events/push-diff-lease-released.event';
import { PushDiffRecorded } from '@change-review/domain/events/push-diff-recorded.event';
import { PushDiffReservationDropped } from '@change-review/domain/events/push-diff-reservation-dropped.event';
import { InvalidPushDiffError } from '@change-review/domain/exceptions/invalid-push-diff.error';
import { PushDiffNotLeasedError } from '@change-review/domain/exceptions/push-diff-not-leased.error';
import { PushDiffStateConflictError } from '@change-review/domain/exceptions/push-diff-state-conflict.error';
import { commitSha as sha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import {
  RunnerClaim,
  MAX_ATTEMPTS,
} from '@change-review/domain/value-objects/runner-claim.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-16T10:00:00.000Z');
const LATER = new Date(NOW.getTime() + 60_000);
const RUNNER = RunnerId.of('pooled_1');
const OTHER = RunnerId.of('pooled_2');
const POOL = PoolId.of('pool_burst');
const HTTP_ERROR = ProvisionFailure.of('http-error', 'answered 503');

const fresh = (placement = RunnerPlacement.anywhere()) =>
  PushDiff.record({
    id: PushDiffId.of('diff_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
    push: {
      head: sha('b'),
      baseTip: sha('a'),
      pushedBy: Pusher.of('  octocat '),
      pushedAt: NOW,
    },
    placement,
    now: NOW,
  });

const recorded = (placement = RunnerPlacement.anywhere()) => {
  const diff = fresh(placement);
  diff.pullEvents();

  return diff;
};

const leased = () => recorded().claimedFor(RUNNER, RunnerOffer.none(), NOW);

const stored = (
  over: Partial<Parameters<typeof PushDiff.rehydrate>[0]> = {},
): PushDiff => {
  const diff = recorded();

  return PushDiff.rehydrate({
    id: diff.id,
    workspaceId: diff.workspaceId,
    taskId: diff.taskId,
    pullRequest: diff.pullRequest,
    repository: diff.repository,
    push: diff.push,
    placement: diff.placement,
    status: 'waiting',
    failure: null,
    claim: RunnerClaim.none(),
    reservation: null,
    provisioning: Provisioning.none(),
    recordedAt: NOW,
    version: 3,
    ...over,
  });
};

describe('PushDiff', () => {
  describe('recorded for a push', () => {
    it('waits for a runner, unclaimed, with who pushed, and says it was recorded', () => {
      const diff = fresh();

      expect(diff.status).toBe('waiting');
      expect(diff.failure).toBeNull();
      expect(diff.claim.claimedBy).toBeNull();
      expect(diff.reservation).toBeNull();
      expect(diff.push.pushedBy?.value).toBe('octocat');
      expect(diff.version).toBe(0);
      expect(diff.claimableAt(NOW)).toBe(true);
      expect(diff.pullEvents()).toEqual([
        new PushDiffRecorded(PushDiffId.of('diff_1')),
      ]);
    });

    it('takes the repository from its pull request', () => {
      expect(fresh().repository.value).toBe('widgets');
    });

    it('is refused for a pull request that names no repository', () => {
      expect(() =>
        PushDiff.record({
          id: PushDiffId.of('diff_1'),
          workspaceId: WorkspaceId.of('ws_1'),
          taskId: TaskId.of('task_1'),
          pullRequest: PullRequestUrl.of('https://github.com/acme'),
          push: fresh().push,
          placement: RunnerPlacement.anywhere(),
          now: NOW,
        }),
      ).toThrow(InvalidPushDiffError);
    });
  });

  describe('claimed by a runner', () => {
    it('is leased to the runner that claimed it, and to nobody else', () => {
      const diff = leased();

      expect(diff.beingDiffedBy(RUNNER, NOW)).toBe(true);
      expect(diff.beingDiffedBy(OTHER, NOW)).toBe(false);
      expect(diff.claim.attempts).toBe(1);
      expect(diff.claimableAt(NOW)).toBe(false);
    });

    it('is refused to a runner without the labels it is placed on', () => {
      const diff = recorded(RunnerPlacement.of(['gpu']));

      expect(diff.claimableBy(RUNNER, RunnerOffer.of(['laptop']), NOW)).toBe(
        false,
      );
      expect(() =>
        diff.claimedFor(RUNNER, RunnerOffer.of(['laptop']), NOW),
      ).toThrow(PushDiffStateConflictError);
      expect(diff.claimableBy(RUNNER, RunnerOffer.of(['gpu']), NOW)).toBe(true);
    });

    it('cannot be claimed twice while the lease runs', () => {
      expect(() => leased().claimedFor(OTHER, RunnerOffer.none(), NOW)).toThrow(
        PushDiffStateConflictError,
      );
    });

    it('may be claimed again once the lease expired', () => {
      const diff = leased();
      const expired = new Date((diff.claim.leaseExpiresAt?.getTime() ?? 0) + 1);

      expect(diff.beingDiffedBy(RUNNER, expired)).toBe(false);
      expect(
        diff.claimedFor(OTHER, RunnerOffer.none(), expired).claim.claimedBy,
      ).toEqual(OTHER);
    });

    it('renews the lease for its runner only', () => {
      const diff = leased();
      const renewed = diff.renewedFor(RUNNER, LATER);

      expect(renewed.claim.leaseExpiresAt?.getTime()).toBeGreaterThan(
        diff.claim.leaseExpiresAt?.getTime() ?? 0,
      );
      expect(() => diff.renewedFor(OTHER, LATER)).toThrow(
        PushDiffNotLeasedError,
      );
    });

    it('goes back to waiting, the claim not counted, when its runner could not take it', () => {
      const diff = leased().unclaimedBy(RUNNER, NOW);

      expect(diff.claim.claimedBy).toBeNull();
      expect(diff.claim.attempts).toBe(0);
      expect(diff.claimableAt(NOW)).toBe(true);
      expect(diff.pullEvents()).toEqual([]);
      expect(() => leased().unclaimedBy(OTHER, NOW)).toThrow(
        PushDiffNotLeasedError,
      );
    });
  });

  describe('diffed', () => {
    it('ends once its runner reports the diff, and releases the runner', () => {
      const diff = leased().settledBy(RUNNER, 'stacked', LATER);

      expect(diff.status).toBe('diffed');
      expect(diff.claim.claimedBy).toBeNull();
      expect(diff.pullEvents()).toEqual([
        new PushDiffLeaseReleased(PushDiffId.of('diff_1')),
      ]);
    });

    it('takes the same report again as already done, and says nothing more', () => {
      const diff = leased().settledBy(RUNNER, 'stacked', LATER);
      diff.pullEvents();

      const again = diff.settledBy(OTHER, 'stacked', LATER);

      expect(again).toBe(diff);
      expect(again.pullEvents()).toEqual([]);
    });

    it('is refused to a runner without the lease', () => {
      expect(() => leased().settledBy(OTHER, 'stacked', LATER)).toThrow(
        PushDiffNotLeasedError,
      );
      expect(() => recorded().settledBy(RUNNER, 'stacked', LATER)).toThrow(
        PushDiffNotLeasedError,
      );
    });
  });

  describe('failed by its runner', () => {
    it('goes back to waiting for another runner while it has attempts left', () => {
      const diff = leased().failedFor(RUNNER, 'clone failed', LATER);

      expect(diff.status).toBe('waiting');
      expect(diff.failure).toBeNull();
      expect(diff.claim.claimedBy).toBeNull();
      expect(diff.pullEvents()).toEqual([
        new PushDiffLeaseReleased(PushDiffId.of('diff_1')),
      ]);
    });

    it('fails with the reason trimmed and cut short once no attempt is left', () => {
      const exhausted = stored({
        claim: RunnerClaim.rehydrate({
          claimedBy: RUNNER,
          attempts: MAX_ATTEMPTS + 1,
          leaseExpiresAt: LATER,
          claimedAt: NOW,
        }),
      });

      const failed = exhausted.failedFor(
        RUNNER,
        `  ${'x'.repeat(2_500)}  `,
        NOW,
      );

      expect(failed.status).toBe('failed');
      expect(failed.failure).toBe('x'.repeat(2_000));
      expect(failed.claim.claimedBy).toBeNull();
      expect(failed.pullEvents()).toEqual([
        new PushDiffLeaseReleased(PushDiffId.of('diff_1')),
      ]);
      expect(exhausted.failedFor(RUNNER, '   ', NOW).failure).toBe(
        'The runner gave no reason.',
      );
    });

    it('is refused to a runner without the lease', () => {
      expect(() => leased().failedFor(OTHER, 'clone failed', LATER)).toThrow(
        PushDiffNotLeasedError,
      );
    });

    it('leaves a diff that is no longer waiting as it is', () => {
      const diffed = leased().settledBy(RUNNER, 'stacked', NOW);

      expect(diffed.failedFor(RUNNER, 'clone failed', LATER)).toBe(diffed);
      expect(diffed.failedFor(OTHER, 'clone failed', LATER)).toBe(diffed);
    });
  });

  describe('refused by the server', () => {
    it('fails at once with the reason, and releases the runner', () => {
      const diff = leased().settledBy(
        RUNNER,
        { refused: ' A diff changes nothing. ' },
        LATER,
      );

      expect(diff.status).toBe('failed');
      expect(diff.failure).toBe('A diff changes nothing.');
      expect(diff.claim.claimedBy).toBeNull();
      expect(diff.pullEvents()).toContainEqual(
        new PushDiffLeaseReleased(diff.id),
      );
    });

    it('is refused to a runner without the lease', () => {
      expect(() =>
        leased().settledBy(OTHER, { refused: 'empty' }, LATER),
      ).toThrow(PushDiffNotLeasedError);
    });

    it('leaves a settled diff as it is, so a retried report changes nothing', () => {
      const refused = leased().settledBy(RUNNER, { refused: 'empty' }, NOW);
      const superseded = leased().settledBy(RUNNER, 'superseded', NOW);

      expect(refused.settledBy(RUNNER, { refused: 'again' }, LATER)).toBe(
        refused,
      );
      expect(superseded.settledBy(RUNNER, { refused: 'again' }, LATER)).toBe(
        superseded,
      );
      expect(refused.settledBy(RUNNER, 'stacked', LATER)).toBe(refused);
    });
  });

  describe('settled by what the stacks show', () => {
    it('fails a push whose task is gone, without calling it superseded', () => {
      const diff = leased().settledBy(RUNNER, 'task-gone', LATER);

      expect(diff.status).toBe('failed');
      expect(diff.failure).toBe('The task of the push is gone.');
      expect(diff.claim.claimedBy).toBeNull();
    });

    it('counts a push its own stack already shows as made', () => {
      expect(leased().settledBy(RUNNER, 'shown', LATER).status).toBe('diffed');
    });

    it('fails a refused push with the reason, and releases the runner', () => {
      const diff = leased().settledBy(
        RUNNER,
        { refused: 'The task is gone.' },
        LATER,
      );

      expect(diff.status).toBe('failed');
      expect(diff.failure).toBe('The task is gone.');
      expect(diff.claim.claimedBy).toBeNull();
      expect(diff.pullEvents()).toContainEqual(
        new PushDiffLeaseReleased(diff.id),
      );
    });
  });

  describe('superseded while its runner made it', () => {
    it('ends superseded, and releases the runner', () => {
      const diff = leased().settledBy(RUNNER, 'superseded', LATER);

      expect(diff.status).toBe('superseded');
      expect(diff.claim.claimedBy).toBeNull();
      expect(diff.pullEvents()).toContainEqual(
        new PushDiffLeaseReleased(diff.id),
      );
    });

    it('is refused to a runner without the lease', () => {
      expect(() => leased().settledBy(OTHER, 'superseded', LATER)).toThrow(
        PushDiffNotLeasedError,
      );
    });

    it('leaves a settled diff as it is', () => {
      const diffed = leased().settledBy(RUNNER, 'stacked', NOW);

      expect(diffed.settledBy(RUNNER, 'superseded', LATER)).toBe(diffed);
    });
  });

  describe('answerable by a runner', () => {
    it('answers its leasing runner while it waits, and anyone once it is settled', () => {
      expect(leased().answerableBy(RUNNER, NOW)).toBe(true);
      expect(leased().answerableBy(OTHER, NOW)).toBe(false);
      expect(recorded().answerableBy(RUNNER, NOW)).toBe(false);
      expect(
        leased()
          .settledBy(RUNNER, 'superseded', NOW)
          .answerableBy(RUNNER, LATER),
      ).toBe(true);
      expect(
        leased()
          .settledBy(RUNNER, { refused: 'empty' }, NOW)
          .answerableBy(OTHER, LATER),
      ).toBe(true);
    });
  });

  describe('superseded by a later push', () => {
    it('stops waiting', () => {
      const diff = recorded().supersededAt(NOW);

      expect(diff.status).toBe('superseded');
      expect(diff.claimableAt(NOW)).toBe(false);
      expect(diff.pullEvents()).toEqual([]);
    });

    it('drops the reservation of the runner provisioned for it, and says so', () => {
      const diff = recorded().reservedFor(RUNNER, POOL, NOW).supersededAt(NOW);

      expect(diff.status).toBe('superseded');
      expect(diff.reservation).toBeNull();
      expect(diff.pullEvents()).toEqual([
        new PushDiffReservationDropped(PushDiffId.of('diff_1'), RUNNER),
      ]);
    });

    it('stays as it is while a runner diffs it, or once it ended', () => {
      const leasedDiff = leased();
      const diffed = leased().settledBy(RUNNER, 'stacked', NOW);

      expect(leasedDiff.supersededAt(NOW)).toBe(leasedDiff);
      expect(diffed.supersededAt(NOW)).toBe(diffed);
    });

    it('is superseded once the lease of its runner expired, and lets go of that runner', () => {
      const diff = leased();
      const expired = new Date((diff.claim.leaseExpiresAt?.getTime() ?? 0) + 1);
      const superseded = diff.supersededAt(expired);

      expect(superseded.status).toBe('superseded');
      expect(superseded.claim.claimedBy).toBeNull();
      expect(superseded.claim.attempts).toBe(1);
    });
  });

  describe('for a runner to be provisioned', () => {
    it('is reserved for one runner, which alone may claim it while the reservation runs', () => {
      const diff = recorded().reservedFor(RUNNER, POOL, NOW);

      expect(diff.isReservedAt(NOW)).toBe(true);
      expect(diff.provisionableAt(NOW)).toBe(false);
      expect(diff.claimableAt(NOW)).toBe(false);
      expect(diff.claimableAt(NOW, RUNNER)).toBe(true);
      expect(diff.claimableAt(NOW, OTHER)).toBe(false);
      expect(
        diff.claimedFor(RUNNER, RunnerOffer.none(), NOW).reservation,
      ).toBeNull();
    });

    it('is open to any runner once the reservation expired', () => {
      const diff = recorded().reservedFor(RUNNER, POOL, NOW);
      const expired = diff.reservation?.until ?? NOW;

      expect(diff.reservationExpiredAt(expired)).toBe(true);
      expect(diff.claimableAt(expired, OTHER)).toBe(true);
    });

    it('cannot be reserved twice, nor once a runner leases it', () => {
      expect(() =>
        recorded().reservedFor(RUNNER, POOL, NOW).reservedFor(OTHER, POOL, NOW),
      ).toThrow(PushDiffStateConflictError);
      expect(() => leased().reservedFor(OTHER, POOL, NOW)).toThrow(
        PushDiffStateConflictError,
      );
    });

    it('drops the reservation of its own runner only', () => {
      const diff = recorded().reservedFor(RUNNER, POOL, NOW);

      expect(diff.unreservedFor(OTHER)).toBe(diff);

      const unreserved = diff.unreservedFor(RUNNER);

      expect(unreserved.reservation).toBeNull();
      expect(unreserved.pullEvents()).toEqual([
        new PushDiffReservationDropped(diff.id, RUNNER),
      ]);
    });

    it('waits to be provisioned again after a failed provision', () => {
      const diff = recorded()
        .reservedFor(RUNNER, POOL, NOW)
        .provisionFailed(RUNNER, HTTP_ERROR, NOW);

      expect(diff.status).toBe('waiting');
      expect(diff.reservation).toBeNull();
      expect(diff.provisioning.attempts).toBe(1);
      expect(diff.provisionableAt(NOW)).toBe(false);
      expect(diff.pullEvents()).toEqual([
        new PushDiffReservationDropped(diff.id, RUNNER),
      ]);
    });

    it('fails once no runner could be provisioned for it', () => {
      let diff = recorded();
      let at = NOW;
      while (diff.status === 'waiting') {
        at = diff.provisioning.nextAttemptAt ?? at;
        diff = diff
          .reservedFor(RUNNER, POOL, at)
          .provisionFailed(RUNNER, HTTP_ERROR, at);
      }

      expect(diff.status).toBe('failed');
      expect(diff.failure).toBe(
        'No runner could be provisioned to make the diff.',
      );
      expect(diff.reservation).toBeNull();
    });

    it('ignores a failed provision another runner reports, or one for a diff no longer waiting', () => {
      const reserved = recorded().reservedFor(RUNNER, POOL, NOW);
      const superseded = reserved.supersededAt(NOW);

      expect(reserved.provisionFailed(OTHER, HTTP_ERROR, NOW)).toBe(reserved);
      expect(superseded.provisionFailed(RUNNER, HTTP_ERROR, NOW)).toBe(
        superseded,
      );
    });
  });

  describe('waiting past its limit', () => {
    it('fails, and lets go of the runner whose lease expired', () => {
      const later = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
      const failed = leased().expireWait(later);

      expect(failed.status).toBe('failed');
      expect(failed.failure).toBe('No runner made the diff in time.');
      expect(failed.claim.claimedBy).toBeNull();
    });
  });

  describe('read back from what was stored', () => {
    it('takes a diff back as it was left', () => {
      const diff = stored({ status: 'failed', failure: 'clone failed' });

      expect(diff.status).toBe('failed');
      expect(diff.failure).toBe('clone failed');
      expect(diff.version).toBe(3);
    });

    it('is refused when it failed with no failure, or carries a failure without failing', () => {
      expect(() => stored({ status: 'failed', failure: null })).toThrow(
        InconsistentStateError,
      );
      expect(() =>
        stored({ status: 'diffed', failure: 'clone failed' }),
      ).toThrow(InconsistentStateError);
    });

    it('is refused when it no longer waits, yet still holds a runner by a lease or a reservation', () => {
      const { claim } = leased();

      expect(() => stored({ status: 'diffed', claim })).toThrow(
        InconsistentStateError,
      );
      expect(() =>
        stored({
          status: 'superseded',
          reservation: RunnerReservation.from(RUNNER, POOL, NOW),
        }),
      ).toThrow(InconsistentStateError);
    });

    it('is refused when its repository is not the one of its pull request', () => {
      expect(() =>
        stored({ repository: RepositoryName.of('gadgets') }),
      ).toThrow(InconsistentStateError);
    });

    it('takes back a diff that no longer waits with the attempts its runners made', () => {
      const diff = stored({
        status: 'diffed',
        claim: leased().claim.released(),
      });

      expect(diff.claim.attempts).toBe(1);
    });
  });
});
