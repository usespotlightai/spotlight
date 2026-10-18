import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import type { SkillResourcesPort } from '@configuration/application/ports/skill-resources.port';
import type { ListSkillResourcesQuery } from '@configuration/application/queries/list-skill-resources.query';
import type { SkillViews } from '@configuration/application/services/skill-views.service';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListSkillResourcesHandler
  implements
    QueryHandlerPort<
      ListSkillResourcesQuery,
      readonly SkillResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: SkillResourcesPort,
    private readonly views: SkillViews,
  ) {}

  async execute(
    query: ListSkillResourcesQuery,
  ): Promise<readonly SkillResourceDto[] | null> {
    try {
      const workspace = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      if (!workspace) {
        return null;
      }

      const teams = await this.teams.inWorkspace(workspace.workspaceId);
      const perTeam = await Promise.all(
        teams.map(async (team) =>
          (await this.resources.ofTeam(team.id)).map((each) =>
            this.views.onTeam(each, team.key),
          ),
        ),
      );

      return perTeam.flat();
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
