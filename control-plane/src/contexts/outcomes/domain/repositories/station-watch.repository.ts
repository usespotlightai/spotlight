import type { StationWatch } from '@outcomes/domain/aggregates/station-watch.aggregate';
import type { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface StationWatchRepository {
  add(watch: StationWatch): Promise<void>;

  save(watch: StationWatch): Promise<void>;

  of(stationId: string, withTask?: TaskId): Promise<StationWatch | null>;

  raising(alertId: AlertId): Promise<StationWatch | null>;

  stationsHolding(taskId: TaskId): Promise<readonly string[]>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
