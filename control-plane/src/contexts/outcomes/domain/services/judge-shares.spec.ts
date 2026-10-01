import { judgeShareOf, shareOf } from '@outcomes/domain/services/judge-shares';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

describe('shareOf', () => {
  it('puts a yes or no and a one-to-five score on one scale from 0 to 1', () => {
    expect(shareOf(ScoreScale.yesNo(), 1)).toBe(1);
    expect(shareOf(ScoreScale.yesNo(), 0)).toBe(0);
    expect(shareOf(ScoreScale.oneToFive(), 1)).toBe(0);
    expect(shareOf(ScoreScale.oneToFive(), 4)).toBe(0.75);
  });
});

describe('judgeShareOf', () => {
  it('averages the shares it has, and says so where it has none', () => {
    expect(judgeShareOf([1, 0.5])).toEqual({ mean: 0.75, judged: 2 });
    expect(judgeShareOf([])).toEqual({ mean: null, judged: 0 });
  });
});
