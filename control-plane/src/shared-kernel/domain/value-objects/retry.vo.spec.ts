import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';
import { describe, expect, it } from 'vitest';

const noon = new Date('2026-09-26T12:00:00.000Z');
const later = (ms: number) => new Date(noon.getTime() + ms);

describe('Retry', () => {
  it('never allows a retry', () => {
    const never = Retry.never();

    expect(never.allowsRetry).toBe(false);
    expect(never.exhaustedAfter(1)).toBe(true);
    expect(never.nextAttemptAt(1, noon)).toBeNull();
  });

  it('waits the initial delay after the first failure and doubles it after each', () => {
    const retry = Retry.backoff({
      maxAttempts: 5,
      initialDelayMs: 5_000,
      maxDelayMs: 120_000,
    });

    expect(retry.nextAttemptAt(1, noon)).toEqual(later(5_000));
    expect(retry.nextAttemptAt(2, noon)).toEqual(later(10_000));
    expect(retry.nextAttemptAt(4, noon)).toEqual(later(40_000));
  });

  it('never waits longer than its maximum delay', () => {
    const retry = Retry.backoff({
      maxAttempts: 20,
      initialDelayMs: 5_000,
      maxDelayMs: 120_000,
    });

    expect(retry.nextAttemptAt(12, noon)).toEqual(later(120_000));
  });

  it('is exhausted once it has used all its attempts', () => {
    const retry = Retry.backoff({
      maxAttempts: 3,
      initialDelayMs: 0,
      maxDelayMs: 0,
    });

    expect(retry.nextAttemptAt(2, noon)).toEqual(noon);
    expect(retry.exhaustedAfter(3)).toBe(true);
    expect(retry.nextAttemptAt(3, noon)).toBeNull();
  });

  it('rejects a backoff that allows no second attempt or waits backwards', () => {
    expect(() =>
      Retry.backoff({ maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0 }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      Retry.backoff({ maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 5 }),
    ).toThrow(InconsistentStateError);
  });
});
