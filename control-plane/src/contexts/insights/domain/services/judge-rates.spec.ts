import {
  judgeDeltaOf,
  judgeRateFrom,
  rateOf,
} from '@insights/domain/services/judge-rates';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

describe('rateOf', () => {
  it('puts a yes or no and a one-to-five score on one scale from 0 to 1', () => {
    expect(rateOf(ScoreScale.yesNo(), 1)).toBe(1);
    expect(rateOf(ScoreScale.yesNo(), 0)).toBe(0);
    expect(rateOf(ScoreScale.oneToFive(), 1)).toBe(0);
    expect(rateOf(ScoreScale.oneToFive(), 4)).toBe(0.75);
  });
});

describe('judgeRateFrom', () => {
  const rubrics = [
    { rubricVersion: 'rubric_1', sum: 0, judged: 1 },
    { rubricVersion: 'rubric_2', sum: 1.5, judged: 2 },
  ];

  it('averages the rates of the qualified rubric over the runs it has', () => {
    expect(judgeRateFrom(rubrics, 'rubric_2')).toEqual({
      mean: 0.75,
      judged: 2,
    });
  });

  it('says so where the qualified rubric judged none of its runs', () => {
    expect(judgeRateFrom(rubrics, 'rubric_3')).toEqual({
      mean: null,
      judged: 0,
    });
    expect(judgeRateFrom(rubrics, null)).toEqual({ mean: null, judged: 0 });
  });
});

describe('judgeDeltaOf', () => {
  it('moves the mean score by percentage points, good when it rose', () => {
    const change = judgeDeltaOf(
      { mean: 0.5, judged: 4 },
      { mean: 0.75, judged: 3 },
    );

    expect(change).toMatchObject({
      unit: 'points',
      direction: 'up',
      tone: 'good',
    });
    expect(change?.by).toBeCloseTo(0.25);
  });

  it('has no change where either side went unjudged', () => {
    expect(judgeDeltaOf(null, { mean: 0.75, judged: 3 })).toBeNull();
    expect(
      judgeDeltaOf({ mean: null, judged: 0 }, { mean: 0.75, judged: 3 }),
    ).toBeNull();
  });
});
