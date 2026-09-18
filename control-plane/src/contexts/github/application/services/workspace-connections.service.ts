import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceConnections implements WorkspaceConnectionsPort {
  constructor(private readonly connections: GitHubConnectionRepository) {}

  async isConnected(workspaceId: WorkspaceId): Promise<boolean> {
    return (await this.connections.of(workspaceId)).isConnected;
  }
}
