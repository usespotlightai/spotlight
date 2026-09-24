import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { RunnerResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { ListRunnerResourcesQuery } from '@runners/application/queries/runner-resource.queries';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListRunnerResourcesHandler
  implements
    QueryHandlerPort<
      ListRunnerResourcesQuery,
      readonly RunnerResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runners: RunnerRepository,
  ) {}

  async execute(
    query: ListRunnerResourcesQuery,
  ): Promise<readonly RunnerResourceDto[] | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      return cleared
        ? (await this.runners.standingIn(cleared.workspaceId))
            .filter((each) => each.holdsWorkspace)
            .map(RunnerResourceMapper.heldRunner)
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
