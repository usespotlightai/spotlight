import type { TaskFailures } from '@outcomes/domain/aggregates/task-failures.aggregate';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskFailuresRepository {
  add(failures: TaskFailures): Promise<void>;

  save(failures: TaskFailures): Promise<void>;

  of(taskId: TaskId): Promise<TaskFailures | null>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
