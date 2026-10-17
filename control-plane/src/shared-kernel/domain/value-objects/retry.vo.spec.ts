import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';
import { describe, expect, it } from 'vitest';

const noon = new Date('2026-09-26T12:00:00.000Z');
const later = (ms: number) => new Date(noon.getTime() + ms);

describe('Retry', () => {
  it('never tries again when it never retries', () => {
    const never = Retry.never();

    expect(never.retries).toBe(false);
    expect(never.exhaustedAfter(1)).toBe(true);
    expect(never.after(1, noon)).toBeNull();
  });

  it('waits the first backoff after the first failure and doubles it after each', () => {
    const retry = Retry.backoff({
      max: 5,
      firstMs: 5_000,
      longestMs: 120_000,
    });

    expect(retry.after(1, noon)).toEqual(later(5_000));
    expect(retry.after(2, noon)).toEqual(later(10_000));
    expect(retry.after(4, noon)).toEqual(later(40_000));
  });

  it('never waits longer than its longest backoff', () => {
    const retry = Retry.backoff({
      max: 20,
      firstMs: 5_000,
      longestMs: 120_000,
    });

    expect(retry.after(12, noon)).toEqual(later(120_000));
  });

  it('gives up once it has failed as many times as it allows attempts', () => {
    const retry = Retry.backoff({ max: 3, firstMs: 0, longestMs: 0 });

    expect(retry.after(2, noon)).toEqual(noon);
    expect(retry.exhaustedAfter(3)).toBe(true);
    expect(retry.after(3, noon)).toBeNull();
  });

  it('rejects a backoff that allows no second attempt or waits backwards', () => {
    expect(() => Retry.backoff({ max: 1, firstMs: 0, longestMs: 0 })).toThrow(
      InconsistentStateError,
    );
    expect(() => Retry.backoff({ max: 3, firstMs: 10, longestMs: 5 })).toThrow(
      InconsistentStateError,
    );
  });
});
