import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const QUEUED_WORK = Symbol('QUEUED_WORK');

// Work that waits for a runner. Runs keeps it, and answers for Runners.
export interface QueuedWorkPort {
  // A run of the workspace is queued and no runner is on its way to it.
  waitsIn(workspaceId: WorkspaceId, now: Date): Promise<boolean>;
}
