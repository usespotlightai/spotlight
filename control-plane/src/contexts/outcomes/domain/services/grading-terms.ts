import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import {
  type JudgeStanding,
  showsJudgeOf,
} from '@outcomes/domain/services/judge-standing';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';

export interface GradingTerms {
  readonly scale: ScoreScale;
  readonly rubricVersion: string | null;
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
  station: {
    readonly scale: ScoreScale | null;
    readonly rubricVersion: string;
  } | null,
): GradingTerms => {
  const judge = latestJudgeOf(scores);

  if (judge) {
    return { scale: judge.scale, rubricVersion: judge.rubricVersion };
  }
  if (station?.scale) {
    return { scale: station.scale, rubricVersion: station.rubricVersion };
  }

  return { scale: ScoreScale.yesNo(), rubricVersion: null };
};
