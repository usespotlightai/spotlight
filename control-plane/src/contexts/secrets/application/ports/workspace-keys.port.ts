import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspaceKeysPort {
  deleteDataKey(workspaceId: WorkspaceId): Promise<void>;
}
