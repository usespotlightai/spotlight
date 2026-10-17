import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceRunnersResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ListWorkspaceRunnersResourcesQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListWorkspaceRunnersResourcesHandler
  implements
    QueryHandlerPort<
      ListWorkspaceRunnersResourcesQuery,
      readonly WorkspaceRunnersResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ListWorkspaceRunnersResourcesQuery,
  ): Promise<readonly WorkspaceRunnersResourceDto[] | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      if (!permissions) {
        return null;
      }

      const record = await this.resources.declaredIn(permissions.workspaceId);

      return record
        ? [
            RunnerResourceMapper.workspaceRunners(
              record,
              permissions.slug,
              await this.resources.credentialSourceKeysIn(record.workspaceId),
            ),
          ]
        : [];
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
