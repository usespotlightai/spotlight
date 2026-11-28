import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BlockingGraph } from '@work/domain/services/blocking-graph';

export const TASK_BLOCKING = Symbol('TASK_BLOCKING');

export interface TaskBlockingPort {
  lockIn(workspaceId: WorkspaceId): Promise<void>;

  graphFrom(
    workspaceId: WorkspaceId,
    blockers: readonly TaskId[],
  ): Promise<BlockingGraph>;
}
