import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const QUEUED_PLACEMENTS = Symbol('QUEUED_PLACEMENTS');

export interface QueuedPlacementsPort {
  unclaimedIn(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly RunnerPlacement[]>;
}
