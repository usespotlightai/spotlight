import type { StationJudge } from '@insights/application/ports/station-judges.port';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export type CurrentStationJudge = StationJudge & {
  readonly scale: ScoreScale | null;
  readonly rubricBody: string | null;
};

export const currentJudgeOf = (
  station: { teamId: TeamId; lineId: LineId },
  judge: StationJudge | null,
): CurrentStationJudge | null => {
  if (
    !judge?.teamId.equals(station.teamId) ||
    !judge.lineId.equals(station.lineId)
  ) {
    return null;
  }

  const rubric = Rubric.readable({
    text: judge.rubric,
    claims: judge.claims,
    passThreshold: judge.passThreshold,
    version: judge.rubricVersion,
  });

  return {
    ...judge,
    scale: rubric?.scale ?? null,
    rubricBody: rubric?.body ?? null,
  };
};
