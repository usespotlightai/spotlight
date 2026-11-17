import {
  type JudgeCalibration,
  showsJudgeOf,
} from '@insights/domain/services/judge-calibration';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';

export const visibleJudgeOf = (
  scores: readonly Scored[],
  calibration: JudgeCalibration,
  current: string | null,
): Scored | null => {
  const judge = scores.find((each) => each.rubricVersion === current) ?? null;

  return judge && showsJudgeOf(calibration, current, judge.rubricVersion)
    ? judge
    : null;
};
