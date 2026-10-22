import { InvalidTraceRangeError } from '@insights/domain/exceptions/invalid-trace-range.error';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import {
  TRACE_RANGES,
  TraceRange,
} from '@insights/domain/value-objects/trace-range.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-29T12:00:00.000Z');

const MINUTE = 60_000;

describe('TraceRange', () => {
  it('measures the stretch back from now', () => {
    const range = TraceRange.of('1h', NOW);

    expect(range.to).toEqual(NOW);
    expect(range.from).toEqual(new Date('2026-08-29T11:00:00.000Z'));
  });

  it('starts an Insights period where Insights starts it, so a drill-down lists the runs its number counts', () => {
    const range = TraceRange.of('7d', NOW);

    expect(range.from).toEqual(InsightsPeriod.of('7d', NOW).current.from);
    expect(range.to).toEqual(NOW);
  });

  it('cuts each stretch into the bars that it was told to make', () => {
    expect(
      Object.fromEntries(
        TRACE_RANGES.map((name) => [
          name,
          TraceRange.of(name, NOW).bucketMs / MINUTE,
        ]),
      ),
    ).toEqual({
      '30m': 2,
      '1h': 2,
      '6h': 10,
      '1d': 10,
      '3d': 30,
      '7d': 60,
      '14d': 2 * 60,
      '30d': 8 * 60,
      '90d': 2 * 24 * 60,
    });
  });

  it('leaves every range with a drawable number of bars', () => {
    for (const name of TRACE_RANGES) {
      const range = TraceRange.of(name, NOW);
      const bars = (range.to.getTime() - range.from.getTime()) / range.bucketMs;

      expect(bars).toBeGreaterThanOrEqual(15);
      expect(bars).toBeLessThanOrEqual(180);
    }
  });

  it('takes only the ranges it knows', () => {
    expect(() => TraceRange.of('2y', NOW)).toThrow(InvalidTraceRangeError);
    expect(() => TraceRange.of('', NOW)).toThrow(
      /^Range must be one of 30m, 1h, 6h, 1d, 3d, 7d, 14d, 30d, 90d\.$/,
    );
  });
});
