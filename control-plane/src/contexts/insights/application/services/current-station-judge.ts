import type { StationJudge } from '@insights/application/ports/station-judges.port';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export type CurrentStationJudge = StationJudge & {
  readonly rubric: Rubric | null;
};

export const currentJudgeOf = (
  station: { teamId: TeamId; lineId: LineId },
  judge: StationJudge | null,
): CurrentStationJudge | null => {
  if (
    judge?.teamId.equals(station.teamId) !== true ||
    !judge.lineId.equals(station.lineId)
  ) {
    return null;
  }

  return {
    ...judge,
    rubric: Rubric.readable({
      claims: judge.claims,
      passThreshold: judge.passThreshold,
      version: judge.rubricVersion,
    }),
  };
};
