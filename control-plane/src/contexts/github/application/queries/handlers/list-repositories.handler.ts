import type {
  RepositoryCatalogPort,
  RepositorySummary,
} from '@github/application/ports/repository-catalog.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { ListRepositoriesQuery } from '@github/application/queries/list-repositories.query';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListRepositoriesHandler
  implements QueryHandlerPort<ListRepositoriesQuery, RepositorySummary[] | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly connections: WorkspaceConnectionsPort,
    private readonly catalog: RepositoryCatalogPort,
  ) {}

  async execute(
    query: ListRepositoriesQuery,
  ): Promise<RepositorySummary[] | null> {
    try {
      const workspace = await this.workspaces.findForMember(
        query.slug,
        UserId.of(query.viewerId),
      );

      if (!workspace) {
        return null;
      }

      const workspaceId = WorkspaceId.of(workspace.id);

      return (await this.connections.isConnected(workspaceId))
        ? await this.catalog.list(workspaceId)
        : [];
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
