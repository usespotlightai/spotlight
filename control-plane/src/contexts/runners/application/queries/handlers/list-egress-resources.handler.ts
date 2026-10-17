import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { EgressResourceDto } from '@runners/application/dto/runner-resource.dto';
import { RunnerResourceMapper } from '@runners/application/mappers/runner-resource.mapper';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import type { ListEgressResourcesQuery } from '@runners/application/queries/runner-resource.queries';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListEgressResourcesHandler
  implements
    QueryHandlerPort<
      ListEgressResourcesQuery,
      readonly EgressResourceDto[] | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: RunnerResourcesPort,
  ) {}

  async execute(
    query: ListEgressResourcesQuery,
  ): Promise<readonly EgressResourceDto[] | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      return permissions
        ? (await this.resources.egressesIn(permissions.workspaceId)).map(
            RunnerResourceMapper.egress,
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
