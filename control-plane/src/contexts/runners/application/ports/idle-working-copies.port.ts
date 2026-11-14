import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const IDLE_WORKING_COPIES = Symbol('IDLE_WORKING_COPIES');

export interface IdleWorkingCopiesPort {
  idleIn(workspaceId: WorkspaceId): Promise<readonly string[]>;
}
