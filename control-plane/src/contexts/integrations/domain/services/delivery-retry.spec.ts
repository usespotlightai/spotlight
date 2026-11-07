import { DELIVERING } from '@integrations/domain/services/delivery-retry';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

describe('DELIVERING', () => {
  it('waits longer after each failed attempt', () => {
    expect(DELIVERING.nextAttemptAt(1, NOW)).toEqual(
      new Date(NOW.getTime() + 2_000),
    );
    expect(DELIVERING.nextAttemptAt(3, NOW)).toEqual(
      new Date(NOW.getTime() + 8_000),
    );
  });

  it('never waits more than an hour', () => {
    const inner = new Date(NOW.getTime() + 60 * 60 * 1000);

    expect(
      DELIVERING.nextAttemptAt(DELIVERING.maxAttempts - 1, NOW)?.getTime(),
    ).toBeLessThanOrEqual(inner.getTime());
  });

  it('schedules no next attempt once the delivery has had its attempts', () => {
    expect(DELIVERING.nextAttemptAt(DELIVERING.maxAttempts, NOW)).toBeNull();
  });
});
