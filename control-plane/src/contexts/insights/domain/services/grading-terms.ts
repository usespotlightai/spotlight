import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import {
  type JudgeCalibration,
  showsJudgeOf,
} from '@insights/domain/services/judge-calibration';
import type { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';

export interface GradingTerms {
  readonly scale: ScoreScale;
  readonly rubricVersion: string | null;
  readonly rubricBody: string | null;
  readonly claims: readonly (string | null)[];
}

export interface Grade {
  readonly scale: ScoreScale;
  readonly value: number;
  readonly claimResults: readonly boolean[] | null;
  readonly rubricVersion: string | null;
}

export const gradeOn = (
  terms: GradingTerms,
  value: boolean | number | null,
  claims: readonly boolean[] | null,
): Grade => {
  if (terms.scale.byClaims) {
    if (claims === null || value !== null) {
      throw new InvalidScoreError(
        'on a claims scale must mark each claim as met or not met',
      );
    }

    return {
      scale: terms.scale,
      value: terms.scale.valueOfClaims(claims, terms.claims.length),
      claimResults: [...claims],
      rubricVersion: terms.rubricVersion,
    };
  }
  if (value === null || claims !== null) {
    throw new InvalidScoreError('must include a grade');
  }

  return {
    scale: terms.scale,
    value: terms.scale.valueOf(value),
    claimResults: null,
    rubricVersion: terms.rubricVersion,
  };
};

interface StationTerms {
  readonly scale: ScoreScale | null;
  readonly rubricVersion: string;
  readonly rubricBody: string | null;
  readonly claims?: readonly string[];
}

export const latestJudgeOf = (scores: readonly Scored[]): Scored | null =>
  scores
    .filter((each) => each.fromJudge)
    .sort(
      (one, other) =>
        other.at.getTime() - one.at.getTime() ||
        other.id.value.localeCompare(one.id.value),
    )[0] ?? null;

export const visibleJudgeOf = (
  scores: readonly Scored[],
  calibration: JudgeCalibration,
  current: string | null,
): Scored | null => {
  const judge = latestJudgeOf(
    scores.filter((each) => each.rubricVersion === current),
  );

  return judge && showsJudgeOf(calibration, current, judge.rubricVersion)
    ? judge
    : null;
};

export const gradingTermsOf = (
  scores: readonly Scored[],
  station: StationTerms | null,
  judgedBy: Rubric | null,
): GradingTerms => {
  const judge = latestJudgeOf(scores);

  if (judge) {
    const rubric = judgedBy?.version === judge.rubricVersion ? judgedBy : null;

    return {
      scale: judge.scale,
      rubricVersion: judge.rubricVersion,
      rubricBody: rubric?.body ?? null,
      claims: (judge.claimResults ?? []).map(
        (_, at) => rubric?.criteria.claims[at] ?? null,
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
