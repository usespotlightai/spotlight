import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const STATION_JUDGES = Symbol('INSIGHTS_STATION_JUDGES');

export interface StationJudge {
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly rubricVersion: RubricVersion;
  readonly sample: number;
  readonly minAgreement: number;
}

export interface StationJudgesPort {
  judgeAt(stationId: StationId): Promise<StationJudge | null>;

  judgesOnTeam(teamId: TeamId): Promise<ReadonlyMap<string, StationJudge>>;
}
