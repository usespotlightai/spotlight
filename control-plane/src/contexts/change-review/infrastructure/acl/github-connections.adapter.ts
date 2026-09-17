import type { GitHubConnectionsPort } from '@change-review/application/ports/github-connections.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class GitHubConnections implements GitHubConnectionsPort {
  constructor(private readonly workspaces: WorkspaceConnectionsPort) {}

  isConnected(workspaceId: WorkspaceId): Promise<boolean> {
    return this.workspaces.isConnected(workspaceId);
  }
}
