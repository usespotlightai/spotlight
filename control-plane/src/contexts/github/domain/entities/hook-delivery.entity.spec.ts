import { HookDelivery } from '@github/domain/entities/hook-delivery.entity';
import { MAX_REDELIVERIES } from '@github/domain/services/hook-redelivery-policy';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-26T12:00:00Z');

const MINUTE_MS = 60_000;

const ago = (ms: number) => new Date(NOW.getTime() - ms);

const failedAt = (id: number, at: Date, guid = 'closed-10') => ({
  id: `${id}`,
  guid,
  deliveredAt: at,
  outcome: 'transient' as const,
});

describe('HookDelivery', () => {
  it('keeps the first failure and follows the latest attempt', () => {
    const delivery = HookDelivery.failed(
      failedAt(1, ago(10 * MINUTE_MS)),
    ).failedAgain(failedAt(2, ago(5 * MINUTE_MS)));

    expect(delivery.firstAt).toEqual(ago(10 * MINUTE_MS));
    expect(delivery.lastAt).toEqual(ago(5 * MINUTE_MS));
    expect(delivery.latestAttemptId).toBe('2');
    expect(delivery.attempts).toBe(2);
  });

  it('waits after a request before it is due again', () => {
    const delivery = HookDelivery.failed(failedAt(1, ago(10 * MINUTE_MS)));

    expect(delivery.isDue(NOW)).toBe(true);
    expect(delivery.requested(NOW).isDue(NOW)).toBe(false);
  });

  it('gives up after the last redelivery, and stays given up', () => {
    let delivery = HookDelivery.failed(failedAt(0, ago(MINUTE_MS)));

    for (let id = 1; id < MAX_REDELIVERIES; id += 1) {
      delivery = delivery.failedAgain(failedAt(id, ago(MINUTE_MS)));
    }

    expect(delivery.gaveUp).toBe(false);

    delivery = delivery.failedAgain(failedAt(MAX_REDELIVERIES, ago(MINUTE_MS)));

    expect(delivery.gaveUp).toBe(true);
    expect(
      delivery.failedAgain(failedAt(MAX_REDELIVERIES + 1, NOW)).gaveUp,
    ).toBe(true);
  });

  it('is gone once GitHub no longer keeps its first attempt', () => {
    const delivery = HookDelivery.failed(
      failedAt(1, ago(3 * 24 * 60 * MINUTE_MS + 1)),
    );

    expect(delivery.isGone(NOW)).toBe(true);
  });

  it('lists the due deliveries, the oldest first', () => {
    const older = HookDelivery.failed(failedAt(1, ago(20 * MINUTE_MS), 'a'));
    const newer = HookDelivery.failed(failedAt(2, ago(10 * MINUTE_MS), 'b'));
    const asked = HookDelivery.failed(
      failedAt(3, ago(30 * MINUTE_MS), 'c'),
    ).requested(NOW);

    expect(
      HookDelivery.dueOldestFirst([newer, asked, older], NOW).map(
        (each) => each.guid,
      ),
    ).toEqual(['a', 'b']);
  });
});
