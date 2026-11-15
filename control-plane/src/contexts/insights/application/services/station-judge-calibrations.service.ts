import type {
  CalibratedStation,
  PublishedCalibration,
  StationJudgeCalibrationsPort,
} from '@insights/application/ports/station-judge-calibrations.port';
import type { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import {
  calibrationReadingOf,
  MIN_PAIRS,
} from '@insights/domain/services/judge-calibration';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StationJudgeCalibrations implements StationJudgeCalibrationsPort {
  constructor(
    private readonly reports: Pick<StationJudgeReports, 'calibrationAt'>,
  ) {}

  async calibrationOf(
    station: CalibratedStation,
  ): Promise<PublishedCalibration | null> {
    const { rubricVersion, calibration } = await this.reports.calibrationAt({
      workspaceId: WorkspaceId.of(station.workspaceId),
      teamId: TeamId.of(station.teamId),
      lineId: LineId.of(station.lineId),
      stationId: StationId.of(station.stationId),
    });

    if (calibration.hiddenReason === 'no-judge') {
      return null;
    }

    return {
      ...calibrationReadingOf({
        calibration,
        calibratedVersion: rubricVersion,
        requestedVersion: station.rubricVersion,
      }),
      minPairs: MIN_PAIRS,
    };
  }
}
