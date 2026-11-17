import {
  type JudgeCalibration,
  showsJudgeOf,
} from '@insights/domain/services/judge-calibration';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';

export const latestJudgeOf = (scores: readonly Scored[]): Scored | null =>
  [...scores].sort(
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
