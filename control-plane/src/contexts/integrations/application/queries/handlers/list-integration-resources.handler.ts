import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { IntegrationResourceDto } from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationResourcesPort } from '@integrations/application/ports/integration-resources.port';
import type { ListIntegrationResourcesQuery } from '@integrations/application/queries/list-integration-resources.query';
import type { IntegrationViews } from '@integrations/application/services/integration-views.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListIntegrationResourcesHandler
  implements
    QueryHandlerPort<
      ListIntegrationResourcesQuery,
      readonly IntegrationResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: IntegrationResourcesPort,
    private readonly views: IntegrationViews,
  ) {}

  async execute(
    query: ListIntegrationResourcesQuery,
  ): Promise<readonly IntegrationResourceDto[] | null> {
    try {
      const workspace = await this.access.permissionsIn(
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
      rethrowAsApplicationError(error);
    }
  }
}
