import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ReadRunnerQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadRunnerHandler
  implements QueryHandlerPort<ReadRunnerQuery, RunnerResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(query: ReadRunnerQuery): Promise<RunnerResourceDto | null> {
    try {
      const kept = await this.resources.runnerWithId(query.runnerId);

      return kept &&
        (await this.access.clearanceIn(kept.workspaceId, query.principal))
        ? RunnerResourceMapper.runner(kept)
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
