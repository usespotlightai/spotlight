import type { WatchedStation } from '@insights/domain/aggregates/station-alert-state.aggregate';
import type { ConfigIntervalBound } from '@insights/domain/services/config-intervals';
import type { LocatedFailure } from '@insights/domain/services/failure-summaries';
import type { AlertFiring } from '@insights/domain/value-objects/alert-firing.vo';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { ScoreFact } from '@insights/domain/value-objects/score-fact.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const STATION_FACTS = Symbol('INSIGHTS_STATION_FACTS');

export interface StationRuns {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId | null;
  readonly stationId: StationId;
  readonly last: number;
}

export interface StationScores {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly rubricVersion?: RubricVersion;
  readonly last: number;
}

interface JudgedStation {
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly rubricVersion: RubricVersion;
}

export interface StationsScores {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly stations: readonly JudgedStation[];
  readonly last: number;
}

export interface FiredAlert {
  readonly station: WatchedStation;
  readonly firing: AlertFiring;
}

export interface StationFactsPort {
  firedAlert(alertId: AlertId): Promise<FiredAlert | null>;

  latestStartedAt(runs: StationRuns): Promise<readonly RunFact[]>;

  lastEndedAt(runs: StationRuns): Promise<readonly RunFact[]>;

  lastConfigRunsBefore(
    teamId: TeamId,
    bounds: readonly ConfigIntervalBound[],
  ): Promise<readonly RunFact[]>;

  ofRuns(runIds: readonly RunId[]): Promise<readonly RunFact[]>;

  ofTasks(taskIds: readonly TaskId[]): Promise<readonly RunFact[]>;

  failuresOfRuns(runIds: readonly RunId[]): Promise<readonly LocatedFailure[]>;

  scoresOfRuns(runIds: readonly RunId[]): Promise<readonly ScoreFact[]>;

  judgedAtStation(criteria: StationScores): Promise<readonly ScoreFact[]>;

  judgedAtStations(criteria: StationsScores): Promise<readonly ScoreFact[]>;
}
