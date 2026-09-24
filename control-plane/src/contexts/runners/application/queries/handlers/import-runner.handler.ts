import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ImportRunnerQuery } from '@runners/application/queries/runner-resource.queries';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportRunnerHandler
  implements QueryHandlerPort<ImportRunnerQuery, RunnerResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(query: ImportRunnerQuery): Promise<RunnerResourceDto | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const kept = cleared
        ? await this.resources.runnerNamed(
            cleared.workspaceId,
            RunnerName.of(query.address).value,
          )
        : null;

      return kept ? RunnerResourceMapper.runner(kept) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
