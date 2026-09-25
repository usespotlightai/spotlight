import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceRunnersResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ReadWorkspaceRunnersQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadWorkspaceRunnersHandler
  implements
    QueryHandlerPort<
      ReadWorkspaceRunnersQuery,
      WorkspaceRunnersResourceDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ReadWorkspaceRunnersQuery,
  ): Promise<WorkspaceRunnersResourceDto | null> {
    try {
      const kept = await this.resources.declaredWithId(query.declarationId);
      const cleared = kept
        ? await this.access.clearanceIn(kept.workspaceId, query.principal)
        : null;

      return kept && cleared
        ? RunnerResourceMapper.workspaceRunners(
            kept,
            cleared.slug,
            await this.resources.waysIn(kept.workspaceId),
          )
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
