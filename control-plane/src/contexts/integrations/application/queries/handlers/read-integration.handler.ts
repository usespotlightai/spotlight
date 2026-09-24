import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { IntegrationResourceDto } from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationResourcesPort } from '@integrations/application/ports/integration-resources.port';
import type { ReadIntegrationQuery } from '@integrations/application/queries/read-integration.query';
import type { IntegrationViews } from '@integrations/application/services/integration-views.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadIntegrationHandler
  implements
    QueryHandlerPort<ReadIntegrationQuery, IntegrationResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IntegrationResourcesPort,
    private readonly views: IntegrationViews,
  ) {}

  async execute(
    query: ReadIntegrationQuery,
  ): Promise<IntegrationResourceDto | null> {
    try {
      const kept = await this.resources.withId(query.integrationId);

      if (
        !kept ||
        !(await this.access.clearanceOnTeam(kept.teamId.value, query.principal))
      ) {
        return null;
      }

      return this.views.of(kept);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
