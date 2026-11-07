import type { GitHubConnectionReaderPort } from '@github/application/ports/github-connection-reader.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceConnections implements WorkspaceConnectionsPort {
  constructor(
    private readonly connections: GitHubConnectionRepository,
    private readonly reader: GitHubConnectionReaderPort,
  ) {}

  async isConnected(workspaceId: WorkspaceId): Promise<boolean> {
    return (await this.reader.installationOf(workspaceId)) !== null;
  }

  async workspaceDeleted(workspaceId: WorkspaceId): Promise<void> {
    const connection = await this.connections.of(workspaceId);
    const disconnected = connection.disconnect();

    if (disconnected !== connection) {
      await this.connections.save(disconnected);
    }
  }
}
