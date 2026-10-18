import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerTrustResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ReadRunnerTrustQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadRunnerTrustHandler
  implements
    QueryHandlerPort<ReadRunnerTrustQuery, RunnerTrustResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ReadRunnerTrustQuery,
  ): Promise<RunnerTrustResourceDto | null> {
    try {
      const record = await this.resources.trustWithId(query.trustId);

      return record &&
        (await this.access.permissionsIn(record.workspaceId, query.principal))
        ? RunnerResourceMapper.trust(record)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
