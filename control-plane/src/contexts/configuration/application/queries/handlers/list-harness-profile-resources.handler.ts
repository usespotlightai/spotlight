import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import type { HarnessProfileResourcesPort } from '@configuration/application/ports/harness-profile-resources.port';
import type { ListHarnessProfileResourcesQuery } from '@configuration/application/queries/list-harness-profile-resources.query';
import type { HarnessProfileViews } from '@configuration/application/services/harness-profile-views.service';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListHarnessProfileResourcesHandler
  implements
    QueryHandlerPort<
      ListHarnessProfileResourcesQuery,
      readonly HarnessProfileResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: HarnessProfileResourcesPort,
    private readonly views: HarnessProfileViews,
  ) {}

  async execute(
    query: ListHarnessProfileResourcesQuery,
  ): Promise<readonly HarnessProfileResourceDto[] | null> {
    try {
      const workspace = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      if (!workspace) {
        return null;
      }

      const teams = await this.teams.inWorkspace(workspace.workspaceId);
      const held = await Promise.all(
        teams.map(async (team) =>
          (await this.resources.ofTeam(team.id)).map((each) =>
            this.views.onTeam(each, team.key),
          ),
        ),
      );

      return held.flat();
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
