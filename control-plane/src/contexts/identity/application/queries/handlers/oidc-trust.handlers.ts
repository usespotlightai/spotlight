import type { OidcTrustResourceDto } from '@identity/application/dto/oidc-trust-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  ImportOidcTrustQuery,
  ListOidcTrustResourcesQuery,
  ReadOidcTrustQuery,
} from '@identity/application/queries/oidc-trust.queries';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReadOidcTrustHandler
  implements QueryHandlerPort<ReadOidcTrustQuery, OidcTrustResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ReadOidcTrustQuery,
  ): Promise<OidcTrustResourceDto | null> {
    try {
      const record = await this.resources.oidcTrustWithId(
        OidcTrustId.of(query.trustId),
      );

      return record &&
        (await this.access.permissionsIn(record.workspaceId, query.principal))
        ? ResourceMapper.oidcTrust(record)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ImportOidcTrustHandler
  implements QueryHandlerPort<ImportOidcTrustQuery, OidcTrustResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ImportOidcTrustQuery,
  ): Promise<OidcTrustResourceDto | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const record = permissions
        ? await this.resources.oidcTrustAt(
            permissions.workspaceId,
            OidcTrustKey.of(query.address).value,
          )
        : null;

      return record ? ResourceMapper.oidcTrust(record) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ListOidcTrustResourcesHandler
  implements
    QueryHandlerPort<
      ListOidcTrustResourcesQuery,
      readonly OidcTrustResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ListOidcTrustResourcesQuery,
  ): Promise<readonly OidcTrustResourceDto[] | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      return permissions
        ? (await this.resources.oidcTrustsIn(permissions.workspaceId)).map(
            ResourceMapper.oidcTrust,
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
