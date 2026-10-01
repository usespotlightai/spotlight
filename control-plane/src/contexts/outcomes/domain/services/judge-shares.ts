import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';

export interface JudgeShare {
  readonly mean: number | null;
  readonly judged: number;
}

export const shareOf = (scale: ScoreScale, value: number): number => {
  const lowest = Math.min(...scale.values);
  const highest = Math.max(...scale.values);

  return highest === lowest ? 0 : (value - lowest) / (highest - lowest);
};

export const judgeShareOf = (shares: readonly number[]): JudgeShare => ({
  mean:
    shares.length === 0
      ? null
      : shares.reduce((sum, each) => sum + each, 0) / shares.length,
  judged: shares.length,
});
