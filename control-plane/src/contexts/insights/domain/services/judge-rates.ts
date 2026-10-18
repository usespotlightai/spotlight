import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { Score } from '@insights/domain/aggregates/score.aggregate';
import { byText } from '@insights/domain/services/measures';
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

export interface JudgedRun {
  readonly runId: string;
  readonly rubricVersion: string;
  readonly rate: number;
}

export interface RubricRates {
  readonly rubricVersion: string;
  readonly sum: number;
  readonly judged: number;
}

export const judgedRunsOf = (
  scores: readonly Score[],
  stationId: string,
): readonly JudgedRun[] =>
  scores.flatMap((each) =>
    each.fromJudge &&
    each.rubricVersion !== null &&
    each.location.stationId === stationId
      ? [
          {
            runId: each.runId.value,
            rubricVersion: each.rubricVersion,
            rate: rateOf(each.scale, each.value),
          },
        ]
      : [],
  );

export const judgedByRun = (
  judged: readonly JudgedRun[],
): ReadonlyMap<string, readonly JudgedRun[]> => {
  const byRun = new Map<string, JudgedRun[]>();

  for (const each of judged) {
    const ofRun = byRun.get(each.runId) ?? [];

    ofRun.push(each);
    byRun.set(each.runId, ofRun);
  }

  return byRun;
};

export const rubricsOf = (
  records: readonly RunRecord[],
  judged: ReadonlyMap<string, readonly JudgedRun[]>,
): readonly RubricRates[] => {
  const byRubric = new Map<string, RubricRates>();

  for (const record of records) {
    for (const each of judged.get(record.runId.value) ?? []) {
      const was = byRubric.get(each.rubricVersion);

      byRubric.set(each.rubricVersion, {
        rubricVersion: each.rubricVersion,
        sum: (was?.sum ?? 0) + each.rate,
        judged: (was?.judged ?? 0) + 1,
      });
    }
  }

  return [...byRubric.values()].sort((one, other) =>
    byText(one.rubricVersion, other.rubricVersion),
  );
};

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
