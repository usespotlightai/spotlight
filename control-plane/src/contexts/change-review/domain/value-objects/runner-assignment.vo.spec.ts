import {
  RunnerAssignment,
  WAITING_LIMIT_MS,
  waitExpiredSince,
} from '@change-review/domain/value-objects/runner-assignment.vo';
import { RunnerClaim } from '@change-review/domain/value-objects/runner-claim.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-16T10:00:00.000Z');
const RUNNER = RunnerId.of('pooled_1');
const OTHER = RunnerId.of('pooled_2');
const POOL = PoolId.of('pool_1');

describe('RunnerAssignment', () => {
  it('may be claimed by any runner while nobody holds or reserves it', () => {
    const none = RunnerAssignment.none();

    expect(none.claimableAt(NOW, null)).toBe(true);
    expect(none.claimableAt(NOW, OTHER)).toBe(true);
    expect(none.provisionableAt(NOW)).toBe(true);
  });

  it('may be claimed only by the runner it is reserved for', () => {
    const reserved = RunnerAssignment.none().reservedFor(RUNNER, POOL, NOW);

    expect(reserved.isReservedAt(NOW)).toBe(true);
    expect(reserved.claimableAt(NOW, RUNNER)).toBe(true);
    expect(reserved.claimableAt(NOW, OTHER)).toBe(false);
    expect(reserved.claimableAt(NOW, null)).toBe(false);
    expect(reserved.provisionableAt(NOW)).toBe(false);
  });

  it('drops the reservation once its runner claims it, and is then leased to that runner', () => {
    const claimed = RunnerAssignment.none()
      .reservedFor(RUNNER, POOL, NOW)
      .claimedBy(RUNNER, NOW);

    expect(claimed.reservation).toBeNull();
    expect(claimed.isLeasedBy(RUNNER, NOW)).toBe(true);
    expect(claimed.claimableAt(NOW, OTHER)).toBe(false);
  });

  it('takes a failed provision only from its reserved runner, and drops the reservation', () => {
    const reserved = RunnerAssignment.none().reservedFor(RUNNER, POOL, NOW);
    const failed = reserved.provisionFailedAt(
      ProvisionFailure.of('unreachable', 'no answer'),
      NOW,
    );

    expect(reserved.takesProvisionFailureFrom(RUNNER, NOW)).toBe(true);
    expect(reserved.takesProvisionFailureFrom(OTHER, NOW)).toBe(false);
    expect(failed.reservation).toBeNull();
    expect(failed.provisioning.attempts).toBe(1);
  });

  it('holds a runner while one leases it or it is reserved for one, and not once released', () => {
    const claimed = RunnerAssignment.none().claimedBy(RUNNER, NOW);

    expect(RunnerAssignment.none().holdsRunner).toBe(false);
    expect(claimed.holdsRunner).toBe(true);
    expect(
      RunnerAssignment.none().reservedFor(RUNNER, POOL, NOW).holdsRunner,
    ).toBe(true);
    expect(claimed.released().holdsRunner).toBe(false);
  });

  it('restarts with no claim, no reservation and no provisioning history', () => {
    const restarted = RunnerAssignment.none()
      .claimedBy(RUNNER, NOW)
      .restarted();

    expect(restarted.isLeasedAt(NOW)).toBe(false);
    expect(restarted.reservation).toBeNull();
    expect(restarted.provisioning.attempts).toBe(0);
  });

  it('expires a wait past the limit only while no runner holds the lease', () => {
    const since = new Date(NOW.getTime() - WAITING_LIMIT_MS - 1);

    expect(waitExpiredSince(since, RunnerClaim.none(), NOW)).toBe(true);
    expect(waitExpiredSince(NOW, RunnerClaim.none(), NOW)).toBe(false);
    expect(
      waitExpiredSince(since, RunnerClaim.none().claimed(RUNNER, NOW), NOW),
    ).toBe(false);
  });
});
