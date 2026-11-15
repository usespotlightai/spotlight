import { type Delta, deltaOf } from '@insights/domain/value-objects/delta.vo';

export interface JudgeRate {
  readonly mean: number | null;
  readonly judged: number;
}

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
  readonly passed: number;
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
        mean: qualifiedRubric.passed / qualifiedRubric.judged,
        judged: qualifiedRubric.judged,
      }
    : { mean: null, judged: 0 };
};
