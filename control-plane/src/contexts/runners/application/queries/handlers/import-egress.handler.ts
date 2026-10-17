import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { EgressResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ImportEgressQuery } from '@runners/application/queries/runner-resource.queries';
import { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportEgressHandler
  implements QueryHandlerPort<ImportEgressQuery, EgressResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(query: ImportEgressQuery): Promise<EgressResourceDto | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const kept = cleared
        ? await this.resources.egressAt(
            cleared.workspaceId,
            EgressKey.of(query.address).value,
          )
        : null;

      return kept ? RunnerResourceMapper.egress(kept) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
