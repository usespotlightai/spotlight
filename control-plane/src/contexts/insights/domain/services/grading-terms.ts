import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import {
  type JudgeCalibration,
  showsJudgeOf,
} from '@insights/domain/services/judge-calibration';
import type { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';

export interface GradingTerms {
  readonly rubricVersion: string;
  readonly passThreshold: number;
  readonly claims: readonly (string | null)[];
}

export interface Grade {
  readonly claimResults: readonly boolean[];
  readonly passThreshold: number;
  readonly rubricVersion: string;
}

export const gradeOn = (
  terms: GradingTerms | null,
  claims: readonly boolean[],
): Grade => {
  if (!terms) {
    throw new InvalidScoreError('needs a judge with claims on the station');
  }
  if (claims.length === 0 || claims.length !== terms.claims.length) {
    throw new InvalidScoreError(
      `must mark all ${terms.claims.length} claims as met or not met`,
    );
  }

  return {
    claimResults: [...claims],
    passThreshold: terms.passThreshold,
    rubricVersion: terms.rubricVersion,
  };
};

export const onEarlierClaims = (
  terms: GradingTerms | null,
  current: string | null,
): boolean =>
  terms !== null && current !== null && terms.rubricVersion !== current;

interface StationTerms {
  readonly rubric: Rubric | null;
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
): GradingTerms | null => {
  const judge = latestJudgeOf(scores);

  if (judge) {
    const rubric =
      [judgedBy, station?.rubric ?? null].find(
        (each) => each?.version === judge.rubricVersion,
      ) ?? null;

    return {
      rubricVersion: judge.rubricVersion,
      passThreshold: judge.passThreshold,
      claims: judge.claimResults.map((_, at) => rubric?.claims[at] ?? null),
    };
  }

  const rubric = station?.rubric ?? null;

  return (
    rubric && {
      rubricVersion: rubric.version,
      passThreshold: rubric.passThreshold,
      claims: [...rubric.claims],
    }
  );
};
