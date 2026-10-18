import type { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskHumanActionsRepository {
  add(humanActions: TaskHumanActions): Promise<void>;

  save(humanActions: TaskHumanActions): Promise<void>;

  of(taskId: TaskId): Promise<TaskHumanActions | null>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
