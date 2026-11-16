import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { JudgeCalibration } from '@replays/domain/value-objects/judge-calibration';
import type { RubricVersion } from '@replays/domain/value-objects/rubric-version.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INSIGHTS = Symbol('REPLAYS_INSIGHTS');

export interface CalibratedJudge {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly rubricVersion: RubricVersion;
}

export interface InsightsPort {
  acceptedAfter(run: RunId): Promise<boolean>;

  originalOutcomes(
    runs: readonly RunId[],
  ): Promise<ReadonlyMap<string, OriginalOutcome>>;

  judgeCalibration(judge: CalibratedJudge): Promise<JudgeCalibration | null>;
}
