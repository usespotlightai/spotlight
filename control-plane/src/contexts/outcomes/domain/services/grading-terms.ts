import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import {
  type JudgeStanding,
  showsJudgeOf,
} from '@outcomes/domain/services/judge-standing';
import type { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';

export interface GradingTerms {
  readonly scale: ScoreScale;
  readonly rubricVersion: string | null;
  readonly rubricBody: string | null;
  readonly claims: readonly (string | null)[];
}

interface StationTerms {
  readonly scale: ScoreScale | null;
  readonly rubricVersion: string;
  readonly rubricBody: string | null;
  readonly claims?: readonly string[];
}

export const latestJudgeOf = (scores: readonly Score[]): Score | null =>
  scores
    .filter((each) => each.fromJudge)
    .sort(
      (one, other) =>
        other.at.getTime() - one.at.getTime() ||
        other.id.value.localeCompare(one.id.value),
    )[0] ?? null;

export const visibleJudgeOf = (
  scores: readonly Score[],
  standing: JudgeStanding,
  current: string | null,
): Score | null => {
  const judge = latestJudgeOf(
    scores.filter((each) => each.rubricVersion === current),
  );

  return judge && showsJudgeOf(standing, current, judge.rubricVersion)
    ? judge
    : null;
};

export const gradingTermsOf = (
  scores: readonly Score[],
  station: StationTerms | null,
  judgedBy: Rubric | null,
): GradingTerms => {
  const judge = latestJudgeOf(scores);

  if (judge) {
    const told = judgedBy?.version === judge.rubricVersion ? judgedBy : null;

    return {
      scale: judge.scale,
      rubricVersion: judge.rubricVersion,
      rubricBody: told?.body ?? null,
      claims: (judge.marks ?? []).map(
        (_, at) => told?.criteria.claims[at] ?? null,
      ),
    };
  }
  if (station?.scale) {
    return {
      scale: station.scale,
      rubricVersion: station.rubricVersion,
      rubricBody: station.rubricBody,
      claims: station.scale.byClaims ? [...(station.claims ?? [])] : [],
    };
  }

  return {
    scale: ScoreScale.yesNo(),
    rubricVersion: null,
    rubricBody: null,
    claims: [],
  };
};
