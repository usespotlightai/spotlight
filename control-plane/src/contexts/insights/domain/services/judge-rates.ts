import { type Delta, deltaOf } from '@insights/domain/value-objects/delta.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';

export interface JudgeRate {
  readonly mean: number | null;
  readonly judged: number;
}

export const rateOf = (scale: ScoreScale, value: number): number => {
  const lowest = Math.min(...scale.values);
  const highest = Math.max(...scale.values);

  return highest === lowest ? 0 : (value - lowest) / (highest - lowest);
};

export const judgeDeltaOf = (
  before: JudgeRate | null,
  after: JudgeRate | null,
): Delta | null =>
  deltaOf(after?.mean ?? null, before?.mean ?? null, {
    better: 'up',
    unit: 'points',
  });

export interface RubricRates {
  readonly rubricVersion: string;
  readonly sum: number;
  readonly judged: number;
}

export const judgeRateFrom = (
  rubrics: readonly RubricRates[],
  qualified: string | null,
): JudgeRate => {
  const qualifiedRubric = rubrics.find(
    (each) => each.rubricVersion === qualified,
  );

  return qualifiedRubric
    ? {
        mean: qualifiedRubric.sum / qualifiedRubric.judged,
        judged: qualifiedRubric.judged,
      }
    : { mean: null, judged: 0 };
};
