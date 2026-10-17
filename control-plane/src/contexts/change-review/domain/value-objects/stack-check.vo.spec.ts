import { MAX_LEASE_MS } from '@change-review/domain/value-objects/check-claim.vo';
import {
  type CheckStatus,
  checkStateAt,
  WAITING_LIMIT_MS,
} from '@change-review/domain/value-objects/stack-check.vo';
import { describe, expect, it } from 'vitest';

const SINCE = new Date('2026-09-16T10:00:00Z');

const PAST_THE_HOUR = new Date(SINCE.getTime() + WAITING_LIMIT_MS + 1);

const checkOf = (over: Partial<CheckStatus> = {}): CheckStatus => ({
  phase: 'waiting',
  waitingSince: SINCE,
  lease: { leaseExpiresAt: null, claimedAt: null },
  ...over,
});

describe('checkStateAt', () => {
  it('waits for a runner for an hour, then counts as skipped', () => {
    expect(checkStateAt(checkOf(), SINCE)).toBe('waiting');
    expect(
      checkStateAt(checkOf(), new Date(SINCE.getTime() + WAITING_LIMIT_MS)),
    ).toBe('waiting');
    expect(checkStateAt(checkOf(), PAST_THE_HOUR)).toBe('skipped');
  });

  it('keeps waiting past the hour while a runner leases it, and is skipped once the lease expires', () => {
    const leasedUntil = new Date(PAST_THE_HOUR.getTime() + 60_000);
    const lease = { leaseExpiresAt: leasedUntil, claimedAt: SINCE };

    expect(checkStateAt(checkOf({ lease }), PAST_THE_HOUR)).toBe('waiting');
    expect(checkStateAt(checkOf({ lease }), leasedUntil)).toBe('skipped');
  });

  it('counts a check leased past the ceiling as not leased, however far its lease goes', () => {
    const ceiling = new Date(SINCE.getTime() + MAX_LEASE_MS);
    const lease = {
      leaseExpiresAt: new Date(ceiling.getTime() + 10 * 60_000),
      claimedAt: SINCE,
    };

    expect(
      checkStateAt(checkOf({ lease }), new Date(ceiling.getTime() - 1)),
    ).toBe('waiting');
    expect(checkStateAt(checkOf({ lease }), ceiling)).toBe('skipped');
  });

  it('waits while it is reordered and keeps the state it ended in', () => {
    expect(checkStateAt(checkOf({ phase: 'reordering' }), PAST_THE_HOUR)).toBe(
      'waiting',
    );
    expect(checkStateAt(checkOf({ phase: 'checked' }), PAST_THE_HOUR)).toBe(
      'checked',
    );
    expect(checkStateAt(checkOf({ phase: 'skipped' }), SINCE)).toBe('skipped');
  });
});
