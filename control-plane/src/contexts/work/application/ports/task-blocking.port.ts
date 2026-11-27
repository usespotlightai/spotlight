import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BlockingGraph } from '@work/domain/services/blocking-graph';

export const TASK_BLOCKING = Symbol('TASK_BLOCKING');

export interface TaskBlockingPort {
  // Holds every other change to what blocks what in the workspace until the transaction ends.
  lockIn(workspaceId: WorkspaceId): Promise<void>;

  graphIn(workspaceId: WorkspaceId): Promise<BlockingGraph>;
}
