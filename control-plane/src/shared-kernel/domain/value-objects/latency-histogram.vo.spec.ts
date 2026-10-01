import { InvalidLatencyHistogramError } from '@shared-kernel/domain/exceptions/invalid-latency-histogram.error';
import {
  LATENCY_BUCKETS,
  LatencyHistogram,
} from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { describe, expect, it } from 'vitest';

describe('LatencyHistogram', () => {
  it('keeps a fixed number of buckets however many calls it times', () => {
    const many = LatencyHistogram.timing(
      Array.from({ length: 10_000 }, (_, at) => at),
    );

    expect(many.counts).toHaveLength(LATENCY_BUCKETS);
    expect(many.timed).toBe(10_000);
  });

  it('puts each call in the bucket its time falls under', () => {
    const counts = LatencyHistogram.timing([
      0, 9, 10, 450, 3_600_000_000,
    ]).counts;

    expect(counts[0]).toBe(2);
    expect(counts[1]).toBe(1);
    expect(counts[5]).toBe(1);
    expect(counts[LATENCY_BUCKETS - 1]).toBe(1);
  });

  it('estimates a percentile within the bucket that holds it', () => {
    const histogram = LatencyHistogram.timing([200, 400, 900]);

    expect(histogram.percentile(50)).toBe(316);
    expect(histogram.percentile(95)).toBe(707);
  });

  it('reads only a percentile above 0 and up to 100', () => {
    const histogram = LatencyHistogram.timing([200]);

    for (const percent of [0, -5, 101, Number.NaN]) {
      expect(() => histogram.percentile(percent)).toThrowError(
        InvalidLatencyHistogramError,
      );
    }
    expect(histogram.percentile(100)).toBe(316);
  });

  it('has no percentile when it timed nothing', () => {
    expect(LatencyHistogram.EMPTY.percentile(50)).toBeNull();
  });

  it('merges two histograms bucket by bucket', () => {
    const merged = LatencyHistogram.timing([15, 450]).plus(
      LatencyHistogram.timing([15]),
    );

    expect(merged.timed).toBe(3);
    expect(merged.counts[1]).toBe(2);
    expect(merged.percentile(50)).toBe(14);
  });

  it('refuses counts that are not whole or not one per bucket', () => {
    expect(() => LatencyHistogram.of([1, 2])).toThrow(
      InvalidLatencyHistogramError,
    );
    expect(() =>
      LatencyHistogram.of(Array.from({ length: LATENCY_BUCKETS }, () => 0.5)),
    ).toThrow(InvalidLatencyHistogramError);
  });

  it('refuses a negative time', () => {
    expect(() => LatencyHistogram.EMPTY.with(-1)).toThrow(
      InvalidLatencyHistogramError,
    );
  });
});
