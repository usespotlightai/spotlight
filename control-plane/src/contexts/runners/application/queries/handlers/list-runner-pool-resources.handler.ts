import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerPoolResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ListRunnerPoolResourcesQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListRunnerPoolResourcesHandler
  implements
    QueryHandlerPort<
      ListRunnerPoolResourcesQuery,
      readonly RunnerPoolResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ListRunnerPoolResourcesQuery,
  ): Promise<readonly RunnerPoolResourceDto[] | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      return permissions
        ? (await this.resources.poolsIn(permissions.workspaceId)).map(
            RunnerResourceMapper.pool,
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
