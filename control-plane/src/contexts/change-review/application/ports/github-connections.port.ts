import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const GITHUB_CONNECTIONS = Symbol('GITHUB_CONNECTIONS');

export interface GitHubConnectionsPort {
  isConnected(workspaceId: WorkspaceId): Promise<boolean>;
}
