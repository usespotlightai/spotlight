import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
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

export interface RunRecordRepository {
  add(record: RunRecord): Promise<void>;

  save(record: RunRecord): Promise<void>;

  of(runId: RunId): Promise<RunRecord | null>;

  ofRuns(runIds: readonly RunId[]): Promise<readonly RunRecord[]>;

  lastEndedOfTaskAt(
    taskId: TaskId,
    stationId: string,
    by: Date,
  ): Promise<RunRecord | null>;

  lastAtStation(criteria: StationRecords): Promise<readonly RunRecord[]>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
