import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspaceKeysPort {
  forget(workspaceId: WorkspaceId): Promise<void>;
}
