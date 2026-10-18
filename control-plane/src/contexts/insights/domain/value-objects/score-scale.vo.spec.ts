import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

describe('ScoreScale', () => {
  it('has yes as 1 and no as 0', () => {
    const scale = ScoreScale.yesNo();

    expect(scale.valueOf(true)).toBe(1);
    expect(scale.valueOf(false)).toBe(0);
    expect(scale.labelOf(1)).toBe('yes');
    expect(scale.categorical).toBe(true);
  });

  it('has whole numbers from 1 to 5', () => {
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
  ] as const)('rejects a value off its scale', (scale, value) => {
    expect(() => scale.valueOf(value)).toThrow(InvalidScoreError);
  });

  it('knows no kind but its own', () => {
    expect(() => ScoreScale.of('stars')).toThrow(InvalidScoreError);
  });

  it('has the share of claims met, given claim by claim', () => {
    const scale = ScoreScale.claims();

    expect(scale.valueOfClaims([true, false, true, true], 4)).toBe(0.75);
    expect(scale.includes(0.75)).toBe(true);
    expect(scale.includes(1.5)).toBe(false);
    expect(scale.byClaims).toBe(true);
    expect(scale.categorical).toBe(false);
    expect(() => scale.valueOfClaims([true], 2)).toThrow(InvalidScoreError);
    expect(() => scale.valueOf(true)).toThrow(InvalidScoreError);
    expect(() => ScoreScale.yesNo().valueOfClaims([true], 1)).toThrow(
      InvalidScoreError,
    );
  });
});
