import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineResourceDto } from '@work/application/dto/line-resource.dto';
import type { LineResourcesPort } from '@work/application/ports/line-resources.port';
import type { ListLineResourcesQuery } from '@work/application/queries/list-line-resources.query';
import type { LineViews } from '@work/application/services/line-views.service';

export class ListLineResourcesHandler
  implements
    QueryHandlerPort<ListLineResourcesQuery, readonly LineResourceDto[] | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: LineResourcesPort,
    private readonly views: LineViews,
  ) {}

  async execute(
    query: ListLineResourcesQuery,
  ): Promise<readonly LineResourceDto[] | null> {
    try {
      const workspace = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      if (!workspace) {
        return null;
      }

      const teams = await this.teams.inWorkspace(workspace.workspaceId);
      const keys = new Map(teams.map((team) => [team.id.value, team.key]));
      const held = await this.resources.ofTeams(teams.map((team) => team.id));

      return held.flatMap((each) => {
        const key = keys.get(each.teamId.value);

        return key === undefined ? [] : [this.views.onTeam(each, key)];
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
