import type { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface StationAlertStateRepository {
  add(alertState: StationAlertState): Promise<void>;

  save(alertState: StationAlertState): Promise<void>;

  of(stationId: string, withTask?: TaskId): Promise<StationAlertState | null>;

  ofAlert(alertId: AlertId): Promise<StationAlertState | null>;

  stationsWithTask(taskId: TaskId): Promise<readonly string[]>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
