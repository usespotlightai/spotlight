import {
  MAX_DELIVERY_ATTEMPTS,
  nextDeliveryAttempt,
} from '@integrations/domain/services/delivery-retry';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

describe('nextDeliveryAttempt', () => {
  it('waits longer after each failed attempt', () => {
    expect(nextDeliveryAttempt(1, NOW)).toEqual(
      new Date(NOW.getTime() + 2_000),
    );
    expect(nextDeliveryAttempt(3, NOW)).toEqual(
      new Date(NOW.getTime() + 8_000),
    );
  });

  it('never waits more than an hour', () => {
    const inner = new Date(NOW.getTime() + 60 * 60 * 1000);

    expect(
      nextDeliveryAttempt(MAX_DELIVERY_ATTEMPTS - 1, NOW)?.getTime(),
    ).toBeLessThanOrEqual(inner.getTime());
  });

  it('gives up once the delivery has had its attempts', () => {
    expect(nextDeliveryAttempt(MAX_DELIVERY_ATTEMPTS, NOW)).toBeNull();
  });
});
