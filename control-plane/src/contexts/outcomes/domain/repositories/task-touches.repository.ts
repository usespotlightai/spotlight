import type { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskTouchesRepository {
  add(touches: TaskTouches): Promise<void>;

  save(touches: TaskTouches): Promise<void>;

  of(taskId: TaskId): Promise<TaskTouches | null>;

  forTasks(taskIds: readonly TaskId[]): Promise<readonly TaskTouches[]>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
