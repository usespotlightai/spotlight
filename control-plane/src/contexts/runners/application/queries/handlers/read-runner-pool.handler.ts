import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerPoolResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ReadRunnerPoolQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadRunnerPoolHandler
  implements QueryHandlerPort<ReadRunnerPoolQuery, RunnerPoolResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ReadRunnerPoolQuery,
  ): Promise<RunnerPoolResourceDto | null> {
    try {
      const kept = await this.resources.poolWithId(query.poolId);

      return kept &&
        (await this.access.permissionsIn(kept.workspaceId, query.principal))
        ? RunnerResourceMapper.pool(kept)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
