import type { OidcTrustSummaryDto } from '@identity/application/dto/oidc-trust-summary.dto';
import type { OidcTrustReaderPort } from '@identity/application/ports/oidc-trust-reader.port';
import type { ListOidcTrustsQuery } from '@identity/application/queries/list-oidc-trusts.query';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListOidcTrustsHandler
  implements
    QueryHandlerPort<ListOidcTrustsQuery, readonly OidcTrustSummaryDto[] | null>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly trusts: OidcTrustReaderPort,
  ) {}

  async execute(
    query: ListOidcTrustsQuery,
  ): Promise<readonly OidcTrustSummaryDto[] | null> {
    try {
      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(query.slug),
      );

      if (!workspace?.permissionsFor(query.principal).seesOidcTrustUsage) {
        return null;
      }

      return await this.trusts.listIn(workspace.id);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
