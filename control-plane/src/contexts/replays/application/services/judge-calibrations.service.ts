import type { InsightsPort } from '@replays/application/ports/insights.port';
import type { StationConfigs } from '@replays/application/services/station-configs.service';
import type { JudgeCalibration } from '@replays/domain/value-objects/judge-calibration';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface JudgedStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly station: {
    readonly lineId: LineId;
    readonly stationId: StationId;
  };
}

export class JudgeCalibrations {
  constructor(
    private readonly configs: Pick<StationConfigs, 'live'>,
    private readonly insights: Pick<InsightsPort, 'judgeCalibration'>,
  ) {}

  async liveAt(at: JudgedStation): Promise<JudgeCalibration | null> {
    const live = await this.configs.live(
      at.station.lineId,
      at.station.stationId,
    );
    const rubricVersion = live?.scoring.rubricVersion ?? null;

    if (live?.scoring.judges !== true || rubricVersion === null) {
      return null;
    }

    return this.insights.judgeCalibration({
      workspaceId: at.workspaceId,
      teamId: at.teamId,
      lineId: at.station.lineId,
      stationId: at.station.stationId,
      rubricVersion,
    });
  }
}
