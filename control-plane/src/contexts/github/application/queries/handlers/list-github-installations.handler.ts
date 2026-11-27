import type { GitHubInstallationDto } from '@github/application/dto/github-installation.dto';
import type { GitHubConnectionReaderPort } from '@github/application/ports/github-connection-reader.port';
import type { ReachableInstallationsPort } from '@github/application/ports/reachable-installations.port';
import type { ListGitHubInstallationsQuery } from '@github/application/queries/list-github-installations.query';
import { workspaceNamesSeenBy } from '@github/application/services/workspace-names';
import { isHeldElsewhere } from '@github/domain/services/installation-holder';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListGitHubInstallationsHandler implements QueryHandlerPort<
  ListGitHubInstallationsQuery,
  GitHubInstallationDto[] | null
> {
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly access: WorkspaceAccessPort,
    private readonly installations: ReachableInstallationsPort,
    private readonly connections: GitHubConnectionReaderPort,
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

      const here = WorkspaceId.of(workspace.id);
      const reachable = await this.installations.of(viewer);
      const holders = new Map(
        (
          await this.connections.connectionsOf(
            reachable.map((each) => each.installation),
          )
        )
          .filter((each) => isHeldElsewhere(each.workspaceId, here))
          .map((each) => [each.installation.value, each.workspaceId]),
      );
      const names = await workspaceNamesSeenBy(
        { access: this.access, workspaces: this.workspaces },
        viewer,
        [...holders.values()],
      );

      return reachable.map(({ installation, account }) => {
        const holder = holders.get(installation.value);

        return {
          id: installation.value,
          account,
          usedElsewhere: holder !== undefined,
          usedBy:
            holder === undefined ? null : (names.get(holder.value) ?? null),
        };
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
