import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { IntegrationResourceDto } from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationResourcesPort } from '@integrations/application/ports/integration-resources.port';
import type { ImportIntegrationQuery } from '@integrations/application/queries/import-integration.query';
import type { IntegrationViews } from '@integrations/application/services/integration-views.service';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportIntegrationHandler
  implements
    QueryHandlerPort<ImportIntegrationQuery, IntegrationResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: IntegrationResourcesPort,
    private readonly views: IntegrationViews,
  ) {}

  async execute(
    query: ImportIntegrationQuery,
  ): Promise<IntegrationResourceDto | null> {
    try {
      const address = IntegrationAddress.parse(query.address);
      const workspace = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const team = workspace
        ? (await this.teams.inWorkspace(workspace.workspaceId)).find(
            (each) => each.key === address.teamKey,
          )
        : undefined;
      const kept = team
        ? await this.resources.at(team.id, address.source.value)
        : null;

      return kept ? this.views.of(kept) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
