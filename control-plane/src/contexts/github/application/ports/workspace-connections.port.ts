import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_CONNECTIONS = Symbol('WORKSPACE_CONNECTIONS');

export interface WorkspaceConnectionsPort {
  isConnected(workspaceId: WorkspaceId): Promise<boolean>;
}
