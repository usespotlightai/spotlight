import { MAX_LEASE_MS } from '@change-review/domain/value-objects/check-claim.vo';
import {
  type CheckStatusInput,
  checkStatusAt,
  WAITING_LIMIT_MS,
} from '@change-review/domain/value-objects/stack-check.vo';
import { describe, expect, it } from 'vitest';

const SINCE = new Date('2026-09-16T10:00:00Z');

const PAST_THE_HOUR = new Date(SINCE.getTime() + WAITING_LIMIT_MS + 1);

const checkOf = (over: Partial<CheckStatusInput> = {}): CheckStatusInput => ({
  status: 'waiting',
  waitingSince: SINCE,
  lease: { leaseExpiresAt: null, claimedAt: null },
  ...over,
});

describe('checkStatusAt', () => {
  it('waits for a runner for an hour, then counts as skipped', () => {
    expect(checkStatusAt(checkOf(), SINCE)).toBe('waiting');
    expect(
      checkStatusAt(checkOf(), new Date(SINCE.getTime() + WAITING_LIMIT_MS)),
    ).toBe('waiting');
    expect(checkStatusAt(checkOf(), PAST_THE_HOUR)).toBe('skipped');
  });

  it('keeps waiting past the hour while a runner leases it, and is skipped once the lease expires', () => {
    const leasedUntil = new Date(PAST_THE_HOUR.getTime() + 60_000);
    const lease = { leaseExpiresAt: leasedUntil, claimedAt: SINCE };

    expect(checkStatusAt(checkOf({ lease }), PAST_THE_HOUR)).toBe('waiting');
    expect(checkStatusAt(checkOf({ lease }), leasedUntil)).toBe('skipped');
  });

  it('counts a check leased past the ceiling as not leased, however far its lease goes', () => {
    const ceiling = new Date(SINCE.getTime() + MAX_LEASE_MS);
    const lease = {
      leaseExpiresAt: new Date(ceiling.getTime() + 10 * 60_000),
      claimedAt: SINCE,
    };

    expect(
      checkStatusAt(checkOf({ lease }), new Date(ceiling.getTime() - 1)),
    ).toBe('waiting');
    expect(checkStatusAt(checkOf({ lease }), ceiling)).toBe('skipped');
  });

  it('waits while it is redrafted and keeps the state it ended in', () => {
    expect(
      checkStatusAt(checkOf({ status: 'redrafting' }), PAST_THE_HOUR),
    ).toBe('waiting');
    expect(checkStatusAt(checkOf({ status: 'checked' }), PAST_THE_HOUR)).toBe(
      'checked',
    );
    expect(checkStatusAt(checkOf({ status: 'skipped' }), SINCE)).toBe(
      'skipped',
    );
  });
});
