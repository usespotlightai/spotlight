import type { GitHubConnectionStatusDto } from '@github/application/dto/github-connection-status.dto';
import type { GitHubAppPort } from '@github/application/ports/github-app.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { ReadGitHubQuery } from '@github/application/queries/read-github.query';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReadGitHubHandler
  implements QueryHandlerPort<ReadGitHubQuery, GitHubConnectionStatusDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly connections: WorkspaceConnectionsPort,
    private readonly app: GitHubAppPort,
  ) {}

  async execute(
    query: ReadGitHubQuery,
  ): Promise<GitHubConnectionStatusDto | null> {
    try {
      const workspace = await this.workspaces.findForMember(
        query.slug,
        UserId.of(query.viewerId),
      );

      if (!workspace) {
        return null;
      }

      const [connected, installUrl] = await Promise.all([
        this.connections.isConnected(WorkspaceId.of(workspace.id)),
        this.app.installUrl(),
      ]);

      return { connected, installUrl };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
