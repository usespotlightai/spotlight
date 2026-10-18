import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerPoolResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ImportRunnerPoolQuery } from '@runners/application/queries/runner-resource.queries';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportRunnerPoolHandler
  implements
    QueryHandlerPort<ImportRunnerPoolQuery, RunnerPoolResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ImportRunnerPoolQuery,
  ): Promise<RunnerPoolResourceDto | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const record = permissions
        ? await this.resources.poolAt(
            permissions.workspaceId,
            PoolKey.of(query.address).value,
          )
        : null;

      return record ? RunnerResourceMapper.pool(record) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
