import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const QUEUED_WORK = Symbol('QUEUED_WORK');

// Work that waits for a runner. Runs keeps it, and answers for Runners.
export interface QueuedWorkPort {
  // A run of the workspace is queued, no runner is on its way to it, and a runner with these labels could take it.
  waitsFor(
    workspaceId: WorkspaceId,
    labels: readonly string[],
    now: Date,
  ): Promise<boolean>;
}
