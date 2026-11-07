import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RecordsOwner {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
}

export interface RunRecordRepository extends ScopedRemoval<RunRecord> {
  add(record: RunRecord): Promise<void>;

  save(record: RunRecord): Promise<void>;

  of(runId: RunId): Promise<RunRecord | null>;

  ofRuns(runIds: readonly RunId[]): Promise<readonly RunRecord[]>;

  ofTasks(taskIds: readonly TaskId[]): Promise<readonly RunRecord[]>;

  lastEndedOfTaskAt(
    taskId: TaskId,
    stationId: StationId,
    by: Date,
  ): Promise<RunRecord | null>;

  runIdsOf(
    owner: RecordsOwner,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunId[]>;

  endedSince(
    since: Date,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunRecord[]>;
}
