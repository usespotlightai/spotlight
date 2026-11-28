import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const QUEUED_WORK = Symbol('QUEUED_WORK');

// The runs of a workspace that are queued while no runner is on its way to them, read at one moment.
export interface WaitingWork {
  // A runner with these labels could take one of them.
  couldBeTakenWith(labels: readonly string[]): boolean;
}

// Work that waits for a runner. Runs keeps it, and answers for Runners.
export interface QueuedWorkPort {
  waitingIn(workspaceId: WorkspaceId, now: Date): Promise<WaitingWork>;
}
