import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import { byText } from '@outcomes/domain/services/measures';
import {
  type Change,
  changeOf,
} from '@outcomes/domain/value-objects/change.vo';
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

export const judgeChangeOf = (
  before: JudgeShare | null,
  after: JudgeShare | null,
): Change | null =>
  changeOf(after?.mean ?? null, before?.mean ?? null, {
    better: 'up',
    unit: 'points',
  });

export interface JudgedRun {
  readonly runId: string;
  readonly rubricVersion: string;
  readonly share: number;
}

export interface RubricShares {
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
    each.place.stationId === stationId
      ? [
          {
            runId: each.runId.value,
            rubricVersion: each.rubricVersion,
            share: shareOf(each.scale, each.value),
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
): readonly RubricShares[] => {
  const byRubric = new Map<string, RubricShares>();

  for (const record of records) {
    for (const each of judged.get(record.runId.value) ?? []) {
      const was = byRubric.get(each.rubricVersion);

      byRubric.set(each.rubricVersion, {
        rubricVersion: each.rubricVersion,
        sum: (was?.sum ?? 0) + each.share,
        judged: (was?.judged ?? 0) + 1,
      });
    }
  }

  return [...byRubric.values()].sort((one, other) =>
    byText(one.rubricVersion, other.rubricVersion),
  );
};

export const judgeShareFrom = (
  rubrics: readonly RubricShares[],
  trusted: string | null,
): JudgeShare => {
  const trustedRubric = rubrics.find((each) => each.rubricVersion === trusted);

  return trustedRubric
    ? {
        mean: trustedRubric.sum / trustedRubric.judged,
        judged: trustedRubric.judged,
      }
    : { mean: null, judged: 0 };
};
