import {
  judgeDeltaOf,
  judgeRateFrom,
} from '@insights/domain/services/judge-rates';
import { describe, expect, it } from 'vitest';

describe('judgeRateFrom', () => {
  const rubrics = [
    { rubricVersion: 'rubric_1', passed: 0, judged: 1 },
    { rubricVersion: 'rubric_2', passed: 3, judged: 4 },
  ];

  it('gives the pass rate of the qualified rubric over the runs it judged', () => {
    expect(judgeRateFrom(rubrics, 'rubric_2')).toEqual({
      mean: 0.75,
      judged: 4,
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
  it('moves the pass rate by percentage points, good when it rose', () => {
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
