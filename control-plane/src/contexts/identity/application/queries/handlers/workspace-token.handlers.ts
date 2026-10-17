import type { WorkspaceTokenResourceDto } from '@identity/application/dto/workspace-token-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  ImportWorkspaceTokenQuery,
  ListWorkspaceTokenResourcesQuery,
  ReadWorkspaceTokenQuery,
} from '@identity/application/queries/workspace-token.queries';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
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
      const record = await this.resources.tokenWithId(
        WorkspaceTokenId.of(query.tokenId),
      );

      return record &&
        (await this.access.permissionsIn(record.workspaceId, query.principal))
        ? ResourceMapper.workspaceToken(record)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
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
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const record = permissions
        ? await this.resources.tokenAt(
            permissions.workspaceId,
            TokenName.of(query.address).value,
          )
        : null;

      return record ? ResourceMapper.workspaceToken(record) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ListWorkspaceTokenResourcesHandler
  implements
    QueryHandlerPort<
      ListWorkspaceTokenResourcesQuery,
      readonly WorkspaceTokenResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ListWorkspaceTokenResourcesQuery,
  ): Promise<readonly WorkspaceTokenResourceDto[] | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      return permissions
        ? (await this.resources.tokensIn(permissions.workspaceId)).map(
            ResourceMapper.workspaceToken,
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
