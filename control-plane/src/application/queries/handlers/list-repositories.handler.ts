import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type {
  RepositoryCatalogPort,
  RepositorySummary,
} from '@application/ports/repository-catalog.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ListRepositoriesQuery } from '@application/queries/list-repositories.query';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class ListRepositoriesHandler
  implements QueryHandlerPort<ListRepositoriesQuery, RepositorySummary[] | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly installations: WorkspaceConnections,
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

      const installation = GitHubInstallation.from(
        await this.installations.connectionTo(
          WorkspaceId.of(workspace.id),
          GitHubInstallation.SOURCE,
        ),
      );

      // Connected to nothing is not the same as not found: the workspace is
      // there, and there is simply nothing yet to raise a task against.
      return installation ? await this.catalog.list(installation) : [];
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
