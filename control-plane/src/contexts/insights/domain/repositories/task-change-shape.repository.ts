import type { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskChangeShapeRepository {
  forTask(taskId: TaskId): Promise<TaskChangeShape | null>;

  add(shape: TaskChangeShape): Promise<void>;

  save(shape: TaskChangeShape): Promise<void>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
