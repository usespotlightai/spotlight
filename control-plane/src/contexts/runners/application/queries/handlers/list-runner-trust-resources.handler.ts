import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerTrustResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ListRunnerTrustResourcesQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListRunnerTrustResourcesHandler
  implements
    QueryHandlerPort<
      ListRunnerTrustResourcesQuery,
      readonly RunnerTrustResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ListRunnerTrustResourcesQuery,
  ): Promise<readonly RunnerTrustResourceDto[] | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      return cleared
        ? (await this.resources.trustsIn(cleared.workspaceId)).map(
            RunnerResourceMapper.trust,
          )
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
