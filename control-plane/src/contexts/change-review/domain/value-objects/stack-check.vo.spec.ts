import { MAX_HOLD_MS } from '@change-review/domain/value-objects/check-claim.vo';
import {
  type CheckStanding,
  checkStateAt,
  WAITING_LIMIT_MS,
} from '@change-review/domain/value-objects/stack-check.vo';
import { describe, expect, it } from 'vitest';

const SINCE = new Date('2026-09-16T10:00:00Z');

const PAST_THE_HOUR = new Date(SINCE.getTime() + WAITING_LIMIT_MS + 1);

const standing = (over: Partial<CheckStanding> = {}): CheckStanding => ({
  phase: 'waiting',
  waitingSince: SINCE,
  hold: { leaseExpiresAt: null, claimedAt: null },
  ...over,
});

describe('checkStateAt', () => {
  it('waits for a runner for an hour, then counts as skipped', () => {
    expect(checkStateAt(standing(), SINCE)).toBe('waiting');
    expect(
      checkStateAt(standing(), new Date(SINCE.getTime() + WAITING_LIMIT_MS)),
    ).toBe('waiting');
    expect(checkStateAt(standing(), PAST_THE_HOUR)).toBe('skipped');
  });

  it('keeps waiting past the hour while a runner holds it, and is skipped once the hold lapses', () => {
    const heldUntil = new Date(PAST_THE_HOUR.getTime() + 60_000);
    const hold = { leaseExpiresAt: heldUntil, claimedAt: SINCE };

    expect(checkStateAt(standing({ hold }), PAST_THE_HOUR)).toBe('waiting');
    expect(checkStateAt(standing({ hold }), heldUntil)).toBe('skipped');
  });

  it('counts a check held past the ceiling as not held, however far its lease reaches', () => {
    const ceiling = new Date(SINCE.getTime() + MAX_HOLD_MS);
    const hold = {
      leaseExpiresAt: new Date(ceiling.getTime() + 10 * 60_000),
      claimedAt: SINCE,
    };

    expect(
      checkStateAt(standing({ hold }), new Date(ceiling.getTime() - 1)),
    ).toBe('waiting');
    expect(checkStateAt(standing({ hold }), ceiling)).toBe('skipped');
  });

  it('waits while it is reordered and keeps the state it settled in', () => {
    expect(checkStateAt(standing({ phase: 'reordering' }), PAST_THE_HOUR)).toBe(
      'waiting',
    );
    expect(checkStateAt(standing({ phase: 'checked' }), PAST_THE_HOUR)).toBe(
      'checked',
    );
    expect(checkStateAt(standing({ phase: 'skipped' }), SINCE)).toBe('skipped');
  });
});
