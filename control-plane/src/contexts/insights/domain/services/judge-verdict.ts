import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';

export const visibleJudgeOf = (
  scores: readonly Scored[],
  calibration: JudgeCalibration,
  current: string | null,
): Scored | null =>
  calibration.qualified && current !== null
    ? (scores.find((each) => each.rubricVersion === current) ?? null)
    : null;
