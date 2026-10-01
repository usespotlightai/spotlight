import { InvalidInsightsPeriodError } from '@outcomes/domain/exceptions/invalid-insights-period.error';
import {
  InsightsPeriod,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T15:30:00.000Z');

describe('InsightsPeriod', () => {
  it('looks back whole UTC days, today included', () => {
    const period = InsightsPeriod.of('7d', NOW);

    expect(period.current).toEqual({
      from: new Date('2026-09-25T00:00:00.000Z'),
      to: new Date('2026-10-02T00:00:00.000Z'),
    });
    expect(period.days).toEqual([
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
  });

  it('compares with the period just before it, as long', () => {
    const period = InsightsPeriod.of('30d', NOW);

    expect(period.previous).toEqual({
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-09-02T00:00:00.000Z'),
    });
  });

  it('looks back far enough for monthly use whatever the period', () => {
    expect(InsightsPeriod.of('7d', NOW).lookback.from).toEqual(
      new Date('2026-09-02T00:00:00.000Z'),
    );
    expect(InsightsPeriod.of('90d', NOW).lookback.from).toEqual(
      new Date('2026-04-05T00:00:00.000Z'),
    );
  });

  it('is only ever 7, 30 or 90 days', () => {
    expect(() => InsightsPeriod.of('14d', NOW)).toThrow(
      InvalidInsightsPeriodError,
    );
    expect(() => InsightsPeriod.of('', NOW)).toThrow(
      InvalidInsightsPeriodError,
    );
  });

  it('says what it looks back over without repeating what it was asked', () => {
    expect(() => InsightsPeriod.of('<b>14d</b>', NOW)).toThrow(
      /^Insights look back 7d, 30d or 90d$/,
    );
  });

  it('holds its start but not its end', () => {
    const { current } = InsightsPeriod.of('7d', NOW);

    expect(within(current, current.from)).toBe(true);
    expect(within(current, current.to)).toBe(false);
    expect(within(current, null)).toBe(false);
  });
});
