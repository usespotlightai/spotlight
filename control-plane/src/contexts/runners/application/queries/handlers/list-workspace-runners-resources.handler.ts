import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceRunnersResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ListWorkspaceRunnersResourcesQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      if (!cleared) {
        return null;
      }

      const kept = await this.resources.declaredIn(cleared.workspaceId);

      return kept
        ? [
            RunnerResourceMapper.workspaceRunners(
              kept,
              cleared.slug,
              await this.resources.waysIn(kept.workspaceId),
            ),
          ]
        : [];
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
