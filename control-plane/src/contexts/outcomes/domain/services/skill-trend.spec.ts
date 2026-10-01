import { skillTrendOf } from '@outcomes/domain/services/skill-trend';
import { describe, expect, it } from 'vitest';

const weeks = (...uses: [number, number][]) =>
  uses.map(([runs, used]) => ({ runs, used }));

describe('skillTrendOf', () => {
  it('spreads when the latest two weeks’ share of runs that used it is 20 points above the weeks before', () => {
    expect(skillTrendOf(weeks([5, 1], [5, 1], [5, 3], [5, 3]))).toBe(
      'spreading',
    );
  });

  it('fades when that share falls 20 points or more', () => {
    expect(skillTrendOf(weeks([5, 4], [5, 4], [5, 2], [5, 2]))).toBe('fading');
  });

  it('holds steady when the share moves less than 20 points', () => {
    expect(skillTrendOf(weeks([10, 5], [10, 5], [10, 6], [10, 6]))).toBe(
      'steady',
    );
  });

  it('counts a move of exactly 20 points', () => {
    expect(skillTrendOf(weeks([5, 2], [5, 2], [5, 3], [5, 3]))).toBe(
      'spreading',
    );
  });

  it('says nothing with fewer than five runs on either side', () => {
    expect(skillTrendOf(weeks([2, 0], [2, 0], [5, 5], [5, 5]))).toBeNull();
    expect(skillTrendOf(weeks([5, 0], [5, 0], [2, 2], [2, 2]))).toBeNull();
  });

  it('says nothing without a week before the latest two', () => {
    expect(skillTrendOf(weeks([20, 1], [20, 19]))).toBeNull();
  });
});
