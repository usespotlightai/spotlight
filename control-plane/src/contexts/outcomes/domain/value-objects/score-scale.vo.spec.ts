import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

describe('ScoreScale', () => {
  it('holds yes as 1 and no as 0', () => {
    const scale = ScoreScale.yesNo();

    expect(scale.valueOf(true)).toBe(1);
    expect(scale.valueOf(false)).toBe(0);
    expect(scale.labelOf(1)).toBe('yes');
    expect(scale.categorical).toBe(true);
  });

  it('holds whole numbers from 1 to 5', () => {
    const scale = ScoreScale.oneToFive();

    expect(scale.valueOf(4)).toBe(4);
    expect(scale.values).toEqual([1, 2, 3, 4, 5]);
    expect(scale.categorical).toBe(false);
  });

  it.each([
    [ScoreScale.yesNo(), 1],
    [ScoreScale.oneToFive(), true],
    [ScoreScale.oneToFive(), 0],
    [ScoreScale.oneToFive(), 2.5],
  ] as const)('refuses a value off its scale', (scale, value) => {
    expect(() => scale.valueOf(value)).toThrow(InvalidScoreError);
  });

  it('knows no kind but its own', () => {
    expect(() => ScoreScale.of('stars')).toThrow(InvalidScoreError);
  });
});
