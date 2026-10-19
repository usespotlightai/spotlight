import {
  exceedsRegressionLimit,
  regressionLimitOf,
  regressionsOf,
} from '@replays/domain/services/search-regressions';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { describe, expect, it } from 'vitest';

const allowing = (maxRegressions: number): ReplayThreshold =>
  ReplayThreshold.of({
    maxRegressions,
    ceiling: 10,
    currency: 'USD',
    minGain: 0.05,
  });

describe('regressionsOf', () => {
  it('totals the searched and held-out regressions, the searched alone until held-out tasks are scored', () => {
    expect(regressionsOf(2, 1).total).toBe(3);
    expect(regressionsOf(2, null).total).toBe(2);
    expect(regressionsOf(null, null).total).toBeNull();
  });
});

describe('exceedsRegressionLimit', () => {
  it('marks regressions on the searched and held-out tasks together over the line’s limit', () => {
    expect(exceedsRegressionLimit(regressionsOf(2, 1), allowing(2))).toBe(true);
    expect(exceedsRegressionLimit(regressionsOf(1, 1), allowing(2))).toBe(
      false,
    );
    expect(exceedsRegressionLimit(regressionsOf(1, 0), allowing(0))).toBe(true);
  });

  it('counts the searched tasks alone until the held-out tasks are scored', () => {
    expect(exceedsRegressionLimit(regressionsOf(3, null), allowing(2))).toBe(
      true,
    );
    expect(exceedsRegressionLimit(regressionsOf(2, null), allowing(2))).toBe(
      false,
    );
  });

  it('marks nothing when the line sets no limit, or nothing could be compared yet', () => {
    expect(exceedsRegressionLimit(regressionsOf(9, 9), null)).toBe(false);
    expect(exceedsRegressionLimit(regressionsOf(null, null), allowing(0))).toBe(
      false,
    );
  });
});

describe('regressionLimitOf', () => {
  it('gives the line’s limit with whether the regressions exceed it', () => {
    expect(regressionLimitOf(regressionsOf(2, 1), allowing(2))).toEqual({
      maxRegressions: 2,
      exceedsRegressionLimit: true,
    });
    expect(regressionLimitOf(regressionsOf(2, 1), null)).toEqual({
      maxRegressions: null,
      exceedsRegressionLimit: false,
    });
  });
});
