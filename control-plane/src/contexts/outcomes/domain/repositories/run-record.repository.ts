import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { StretchBound } from '@outcomes/domain/services/config-stretches';
import type { RunFilter } from '@outcomes/domain/services/run-filter';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface StationRecords {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string | null;
  readonly stationId: string;
  readonly last: number;
}

export interface TeamWindow {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly from: Date;
  readonly to: Date;
}

export interface RunListing {
  readonly window: TeamWindow;
  readonly filter: RunFilter;
  readonly offset: number;
  readonly limit: number;
}

export interface RunPage {
  readonly records: readonly RunRecord[];
  readonly total: number;
}

export interface RunRecordRepository {
  add(record: RunRecord): Promise<void>;

  save(record: RunRecord): Promise<void>;

  of(runId: RunId): Promise<RunRecord | null>;

  ofRuns(runIds: readonly RunId[]): Promise<readonly RunRecord[]>;

  ofTasks(taskIds: readonly TaskId[]): Promise<readonly RunRecord[]>;

  lastEndedOfTaskAt(
    taskId: TaskId,
    stationId: string,
    by: Date,
  ): Promise<RunRecord | null>;

  lastConfigRunsBefore(
    teamId: TeamId,
    bounds: readonly StretchBound[],
  ): Promise<readonly RunRecord[]>;

  lastAtStation(criteria: StationRecords): Promise<readonly RunRecord[]>;

  latestStartedAtStation(
    criteria: StationRecords,
  ): Promise<readonly RunRecord[]>;

  endedForTeam(window: TeamWindow, most: number): Promise<readonly RunRecord[]>;

  listedForTeam(listing: RunListing): Promise<RunPage>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
