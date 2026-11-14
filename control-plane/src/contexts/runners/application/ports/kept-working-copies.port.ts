import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const KEPT_WORKING_COPIES = Symbol('KEPT_WORKING_COPIES');

export interface KeptWorkingCopiesPort {
  keptIn(workspaceId: WorkspaceId): Promise<readonly string[]>;
}
