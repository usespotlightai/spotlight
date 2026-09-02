import { describe, expect, it } from 'vitest';
import {
  bucketMsOf,
  DEFAULT_RANGE,
  RANGES,
  rangeOf,
  windowOf,
} from '@/lib/range';

/** The bar sizes each range was asked for, minute for minute. */
const ASKED = {
  '30m': 2,
  '1h': 2,
  '6h': 10,
  '1d': 10,
  '3d': 30,
  '7d': 60,
  '14d': 2 * 60,
  '30d': 8 * 60,
  '90d': 2 * 24 * 60,
} as const;

describe('RANGES', () => {
  it('cuts each stretch into the bars it was asked for', () => {
    expect(
      Object.fromEntries(
        RANGES.map((range) => [range.id, range.bucketMinutes]),
      ),
    ).toEqual(ASKED);
  });

  // Few enough to draw, many enough to have a shape: a month of half hours
  // would be 1,440 bars thinner than a pixel. Each band holds two bars, so
  // the room one needs is twice what a single series would.
  it('leaves every range with a drawable number of bars', () => {
    for (const range of RANGES) {
      const bars = range.minutes / range.bucketMinutes;

      expect(bars).toBeGreaterThanOrEqual(15);
      expect(bars).toBeLessThanOrEqual(180);
    }
  });

  it('measures the stretch back from now', () => {
    const now = Date.UTC(2026, 7, 29, 12, 0, 0);
    const held = windowOf('1h', now);

    expect(held.to).toBe(now);
    expect(held.to - held.from).toBe(60 * 60_000);
  });

  it('gives the bucket as milliseconds', () => {
    expect(bucketMsOf('30d')).toBe(8 * 60 * 60_000);
  });

  // An unknown id is not worth failing a page over.
  it('falls back to the default where the range is not one it knows', () => {
    expect(rangeOf('nonsense').id).toBe(DEFAULT_RANGE);
  });
});
