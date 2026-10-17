import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { EgressResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ReadEgressQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadEgressHandler
  implements QueryHandlerPort<ReadEgressQuery, EgressResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(query: ReadEgressQuery): Promise<EgressResourceDto | null> {
    try {
      const kept = await this.resources.egressWithId(query.egressId);

      return kept &&
        (await this.access.permissionsIn(kept.workspaceId, query.principal))
        ? RunnerResourceMapper.egress(kept)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
