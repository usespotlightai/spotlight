import type { ConfigurationChangeDto } from '@identity/application/dto/configuration-change.dto';
import type { ConfigurationAuditPort } from '@identity/application/ports/configuration-audit.port';
import type { ListConfigurationChangesQuery } from '@identity/application/queries/list-configuration-changes.query';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListConfigurationChangesHandler
  implements
    QueryHandlerPort<
      ListConfigurationChangesQuery,
      readonly ConfigurationChangeDto[] | null
    >
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly audit: ConfigurationAuditPort,
  ) {}

  async execute(
    query: ListConfigurationChangesQuery,
  ): Promise<readonly ConfigurationChangeDto[] | null> {
    try {
      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(query.slug),
      );

      if (!workspace?.permissionsFor(query.principal).administers) {
        return null;
      }

      return await this.audit.changesIn(workspace.id, query.page);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
