import type { JudgeCalibrationPort } from '@outcomes/application/ports/judge-calibration.port';
import type { JudgeCalibration } from '@outcomes/domain/services/judge-calibration';
import type { TeamAccess } from '@outcomes/domain/services/team-access';
import type { StationPlace } from '@outcomes/domain/services/team-history';

export interface StationJudgeCalibration
  extends StationPlace,
    JudgeCalibration {
  readonly rubricVersion: string | null;
}

export interface JudgeCalibrations {
  readonly judges: readonly StationJudgeCalibration[];
  readonly trusted: ReadonlyMap<string, string>;
}

export class TrustedJudges {
  constructor(private readonly judges: JudgeCalibrationPort) {}

  async calibrations(
    access: TeamAccess,
    stations: readonly StationPlace[],
  ): Promise<JudgeCalibrations> {
    const shapes = await this.judges.calibrationsOf(
      {
        workspaceId: access.workspaceId.value,
        teamId: access.teamId.value,
      },
      stations.map((station) => ({
        lineId: station.lineId,
        stationId: station.stationId,
      })),
    );
    const byStation = new Map(shapes.map((each) => [each.stationId, each]));
    const judges = stations.flatMap((station) => {
      const shape = byStation.get(station.stationId);

      return !shape || shape.hiddenBecause === 'no-judge'
        ? []
        : [
            {
              lineId: station.lineId,
              stationId: station.stationId,
              rubricVersion: shape.rubricVersion,
              trusted: shape.trusted,
              measure: shape.measure,
              agreement: shape.agreement,
              pairs: shape.pairs,
              trust: shape.trust,
              hiddenBecause: shape.hiddenBecause,
            },
          ];
    });

    return {
      judges,
      trusted: new Map(
        judges.flatMap((each) =>
          each.trusted && each.rubricVersion !== null
            ? [[each.stationId, each.rubricVersion] as const]
            : [],
        ),
      ),
    };
  }
}
