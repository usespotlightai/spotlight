import type { WorkspaceTokenTrustResourceDto } from '@identity/application/dto/workspace-token-trust-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  ImportWorkspaceTokenTrustQuery,
  ListWorkspaceTokenTrustResourcesQuery,
  ReadWorkspaceTokenTrustQuery,
} from '@identity/application/queries/workspace-token-trust.queries';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class ReadWorkspaceTokenTrustHandler
  implements
    QueryHandlerPort<
      ReadWorkspaceTokenTrustQuery,
      WorkspaceTokenTrustResourceDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ReadWorkspaceTokenTrustQuery,
  ): Promise<WorkspaceTokenTrustResourceDto | null> {
    try {
      const record = await this.resources.tokenTrustWithId(
        WorkspaceTokenTrustId.of(query.trustId),
      );

      return record &&
        (await this.access.permissionsIn(record.workspaceId, query.principal))
        ? ResourceMapper.workspaceTokenTrust(record)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ImportWorkspaceTokenTrustHandler
  implements
    QueryHandlerPort<
      ImportWorkspaceTokenTrustQuery,
      WorkspaceTokenTrustResourceDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ImportWorkspaceTokenTrustQuery,
  ): Promise<WorkspaceTokenTrustResourceDto | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const record = permissions
        ? await this.resources.tokenTrustAt(
            permissions.workspaceId,
            TokenTrustKey.of(query.address).value,
          )
        : null;

      return record ? ResourceMapper.workspaceTokenTrust(record) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ListWorkspaceTokenTrustResourcesHandler
  implements
    QueryHandlerPort<
      ListWorkspaceTokenTrustResourcesQuery,
      readonly WorkspaceTokenTrustResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ListWorkspaceTokenTrustResourcesQuery,
  ): Promise<readonly WorkspaceTokenTrustResourceDto[] | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      return permissions
        ? (await this.resources.tokenTrustsIn(permissions.workspaceId)).map(
            ResourceMapper.workspaceTokenTrust,
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
