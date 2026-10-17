import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceRunnersResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ImportWorkspaceRunnersQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportWorkspaceRunnersHandler
  implements
    QueryHandlerPort<
      ImportWorkspaceRunnersQuery,
      WorkspaceRunnersResourceDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ImportWorkspaceRunnersQuery,
  ): Promise<WorkspaceRunnersResourceDto | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const kept =
        permissions && permissions.slug === query.address
          ? await this.resources.declaredIn(permissions.workspaceId)
          : null;

      return kept && permissions
        ? RunnerResourceMapper.workspaceRunners(
            kept,
            permissions.slug,
            await this.resources.waysIn(kept.workspaceId),
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
