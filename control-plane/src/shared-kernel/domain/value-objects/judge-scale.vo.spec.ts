import { InvalidJudgeCriteriaError } from '@shared-kernel/domain/exceptions/invalid-judge-criteria.error';
import {
  claimShareOf,
  JudgeScale,
  PASSING_SCORE,
} from '@shared-kernel/domain/value-objects/judge-scale.vo';
import { describe, expect, it } from 'vitest';

describe('JudgeScale', () => {
  it('takes only a score on its scale', () => {
    expect(JudgeScale.of('yes-no').includes(1)).toBe(true);
    expect(JudgeScale.of('yes-no').includes(2)).toBe(false);
    expect(JudgeScale.of('number').includes(5)).toBe(true);
    expect(JudgeScale.of('number').includes(2.5)).toBe(false);
    expect(JudgeScale.of('claims').includes(0.75)).toBe(true);
    expect(JudgeScale.of('claims').includes(1.5)).toBe(false);
    expect(() => JudgeScale.of('stars')).toThrow(InvalidJudgeCriteriaError);
  });

  it('passes a yes, a number from the passing score up, and claims by the share met', () => {
    expect(JudgeScale.of('yes-no').passes(1, 1)).toBe(true);
    expect(JudgeScale.of('yes-no').passes(0, 1)).toBe(false);
    expect(JudgeScale.of('number').passes(PASSING_SCORE, 1)).toBe(true);
    expect(JudgeScale.of('number').passes(PASSING_SCORE - 1, 1)).toBe(false);
    expect(JudgeScale.of('claims').passes(2 / 3, 2 / 3)).toBe(true);
    expect(JudgeScale.of('claims').passes(0.5, 0.6)).toBe(false);
  });

  it('puts a score as its share of the scale, from 0 at the lowest to 1 at the highest', () => {
    expect(JudgeScale.of('yes-no').shareOf(1)).toBe(1);
    expect(JudgeScale.of('number').shareOf(1)).toBe(0);
    expect(JudgeScale.of('number').shareOf(4)).toBe(0.75);
    expect(JudgeScale.of('claims').shareOf(0.5)).toBe(0.5);
  });

  it('marks claims only when it scores by claims, at the share it scores', () => {
    expect(JudgeScale.of('claims').marks(0.5, [true, false])).toBe(true);
    expect(JudgeScale.of('claims').marks(1, [true, false])).toBe(false);
    expect(JudgeScale.of('claims').marks(1, null)).toBe(false);
    expect(JudgeScale.of('yes-no').marks(1, null)).toBe(true);
    expect(JudgeScale.of('yes-no').marks(1, [true])).toBe(false);
    expect(claimShareOf([true, false, true, true])).toBe(0.75);
  });
});
