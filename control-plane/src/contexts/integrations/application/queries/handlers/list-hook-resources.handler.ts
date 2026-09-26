import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { HookResourceDto } from '@integrations/application/dto/hook-resource.dto';
import type { HookResourcesPort } from '@integrations/application/ports/hook-resources.port';
import type { ListHookResourcesQuery } from '@integrations/application/queries/list-hook-resources.query';
import type { HookViews } from '@integrations/application/services/hook-views.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListHookResourcesHandler
  implements
    QueryHandlerPort<ListHookResourcesQuery, readonly HookResourceDto[] | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: HookResourcesPort,
    private readonly views: HookViews,
  ) {}

  async execute(
    query: ListHookResourcesQuery,
  ): Promise<readonly HookResourceDto[] | null> {
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
