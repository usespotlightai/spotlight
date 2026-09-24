import type { WorkspaceResourceDto } from '@identity/application/dto/workspace-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ImportWorkspaceQuery } from '@identity/application/queries/import-workspace.query';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ImportWorkspaceHandler
  implements QueryHandlerPort<ImportWorkspaceQuery, WorkspaceResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ImportWorkspaceQuery,
  ): Promise<WorkspaceResourceDto | null> {
    try {
      const kept = await this.resources.workspaceWithSlug(
        WorkspaceSlug.of(query.address).value,
      );

      return kept && (await this.access.clearanceIn(kept.id, query.principal))
        ? ResourceMapper.workspace(kept)
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
