import type { JudgeCalibrationPort } from '@insights/application/ports/judge-calibration.port';
import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import type { TeamAccess } from '@insights/domain/services/team-access';
import type { StationLocation } from '@insights/domain/services/team-history';

export interface StationJudgeCalibration
  extends StationLocation,
    JudgeCalibration {
  readonly rubricVersion: string | null;
}

export interface JudgeCalibrations {
  readonly judges: readonly StationJudgeCalibration[];
  readonly qualified: ReadonlyMap<string, string>;
}

export class QualifiedJudges {
  constructor(private readonly judges: JudgeCalibrationPort) {}

  async calibrations(
    access: TeamAccess,
    stations: readonly StationLocation[],
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

      return !shape || shape.hiddenReason === 'no-judge'
        ? []
        : [
            {
              lineId: station.lineId,
              stationId: station.stationId,
              rubricVersion: shape.rubricVersion,
              qualified: shape.qualified,
              measure: shape.measure,
              agreement: shape.agreement,
              pairs: shape.pairs,
              minAgreement: shape.minAgreement,
              hiddenReason: shape.hiddenReason,
            },
          ];
    });

    return {
      judges,
      qualified: new Map(
        judges.flatMap((each) =>
          each.qualified && each.rubricVersion !== null
            ? [[each.stationId, each.rubricVersion] as const]
            : [],
        ),
      ),
    };
  }
}
