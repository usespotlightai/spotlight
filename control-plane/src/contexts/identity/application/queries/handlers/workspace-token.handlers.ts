import type { WorkspaceTokenResourceDto } from '@identity/application/dto/workspace-token-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  ImportWorkspaceTokenQuery,
  ReadWorkspaceTokenQuery,
} from '@identity/application/queries/workspace-token.queries';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

export class ReadWorkspaceTokenHandler
  implements
    QueryHandlerPort<ReadWorkspaceTokenQuery, WorkspaceTokenResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ReadWorkspaceTokenQuery,
  ): Promise<WorkspaceTokenResourceDto | null> {
    try {
      const kept = await this.resources.tokenWithId(
        WorkspaceTokenId.of(query.tokenId),
      );

      return kept &&
        (await this.access.clearanceIn(kept.workspaceId, query.principal))
        ? ResourceMapper.workspaceToken(kept)
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class ImportWorkspaceTokenHandler
  implements
    QueryHandlerPort<
      ImportWorkspaceTokenQuery,
      WorkspaceTokenResourceDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ImportWorkspaceTokenQuery,
  ): Promise<WorkspaceTokenResourceDto | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const kept = cleared
        ? await this.resources.tokenAt(
            cleared.workspaceId,
            TokenName.of(query.address).value,
          )
        : null;

      return kept ? ResourceMapper.workspaceToken(kept) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
