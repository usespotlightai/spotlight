import type { TeamResourceDto } from '@identity/application/dto/team-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ListTeamResourcesQuery } from '@identity/application/queries/list-team-resources.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ListTeamResourcesHandler
  implements
    QueryHandlerPort<ListTeamResourcesQuery, readonly TeamResourceDto[] | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ListTeamResourcesQuery,
  ): Promise<readonly TeamResourceDto[] | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );

      return permissions
        ? (await this.resources.teamsIn(permissions.workspaceId)).map(
            ResourceMapper.team,
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
