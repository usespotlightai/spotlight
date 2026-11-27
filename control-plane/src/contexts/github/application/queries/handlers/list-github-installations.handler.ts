import type { GitHubInstallationDto } from '@github/application/dto/github-installation.dto';
import type { ReachableInstallationsPort } from '@github/application/ports/reachable-installations.port';
import type { ListGitHubInstallationsQuery } from '@github/application/queries/list-github-installations.query';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListGitHubInstallationsHandler implements QueryHandlerPort<
  ListGitHubInstallationsQuery,
  GitHubInstallationDto[] | null
> {
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly installations: ReachableInstallationsPort,
  ) {}

  async execute(
    query: ListGitHubInstallationsQuery,
  ): Promise<GitHubInstallationDto[] | null> {
    try {
      const viewer = UserId.of(query.viewerId);
      const workspace = await this.workspaces.findForMember(query.slug, viewer);

      if (!workspace) {
        return null;
      }

      const reachable = await this.installations.of(viewer);

      return reachable.map(({ installation, account }) => ({
        id: installation.value,
        account,
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
