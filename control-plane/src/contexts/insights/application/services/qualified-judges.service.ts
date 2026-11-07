import type { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import type { StationLocation } from '@insights/domain/services/station-ranking';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { ViewedTeam } from '@insights/domain/value-objects/viewed-team.vo';

interface StationJudgeCalibration extends StationLocation, JudgeCalibration {
  readonly rubricVersion: RubricVersion | null;
}

export interface JudgeCalibrations {
  readonly judges: readonly StationJudgeCalibration[];
  readonly qualified: ReadonlyMap<string, RubricVersion>;
}

export class QualifiedJudges {
  constructor(
    private readonly judges: Pick<StationJudgeReports, 'calibrationsOf'>,
  ) {}

  async calibrations(
    access: ViewedTeam,
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
