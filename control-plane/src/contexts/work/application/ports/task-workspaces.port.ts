import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TASK_WORKSPACES = Symbol('TASK_WORKSPACES');

export interface TaskWorkspacesPort {
  workspaceOf(taskId: TaskId): Promise<WorkspaceId | null>;
}
