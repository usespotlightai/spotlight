import { DeliveryAttempts } from '@change-review/domain/value-objects/delivery-attempts.vo';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-16T10:00:00Z');

const later = (ms: number) => new Date(NOW.getTime() + ms);

describe('DeliveryAttempts', () => {
  it('waits a minute for a pull request without counting the wait', () => {
    expect(DeliveryAttempts.of(4).untilPullRequest(NOW)).toEqual({
      at: later(60_000),
      counted: false,
    });
  });

  it('gives up at once on a permanent failure', () => {
    expect(
      DeliveryAttempts.of(0).retryAfter(
        DeliveryFailure.of('not-connected'),
        NOW,
      ),
    ).toBeNull();
  });

  it('backs off while GitHub cannot be reached, and gives up on the sixth attempt', () => {
    const failure = DeliveryFailure.of('github-unreachable');

    expect(DeliveryAttempts.of(0).retryAfter(failure, NOW)).toEqual({
      at: later(30_000),
      counted: true,
    });
    expect(DeliveryAttempts.of(2).retryAfter(failure, NOW)).toEqual({
      at: later(120_000),
      counted: true,
    });
    expect(DeliveryAttempts.of(5).retryAfter(failure, NOW)).toBeNull();
  });

  it('waits a minute for the thread a reply answers, thirty times at most', () => {
    const failure = DeliveryFailure.of('parent-not-on-github');

    expect(DeliveryAttempts.of(10).retryAfter(failure, NOW)).toEqual({
      at: later(60_000),
      counted: true,
    });
    expect(DeliveryAttempts.of(29).retryAfter(failure, NOW)).toBeNull();
  });

  it('refuses a count that cannot be stored', () => {
    expect(() => DeliveryAttempts.of(-1)).toThrow(InconsistentStateError);
  });
});
