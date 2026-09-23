import type { WorkspaceResourceDto } from '@identity/application/dto/workspace-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ReadWorkspaceQuery } from '@identity/application/queries/read-workspace.query';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReadWorkspaceHandler
  implements QueryHandlerPort<ReadWorkspaceQuery, WorkspaceResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ReadWorkspaceQuery,
  ): Promise<WorkspaceResourceDto | null> {
    try {
      const kept = await this.resources.workspaceWithId(
        WorkspaceId.of(query.workspaceId),
      );

      return kept &&
        (await this.access.inWorkspaceWithId(
          kept.id,
          UserId.of(query.viewerId),
        ))
        ? ResourceMapper.workspace(kept)
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
