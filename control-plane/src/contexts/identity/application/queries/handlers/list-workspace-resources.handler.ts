import type { WorkspaceResourceDto } from '@identity/application/dto/workspace-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type {
  IdentityResourcesPort,
  WorkspaceRecord,
} from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ListWorkspaceResourcesQuery } from '@identity/application/queries/list-workspace-resources.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListWorkspaceResourcesHandler
  implements
    QueryHandlerPort<
      ListWorkspaceResourcesQuery,
      readonly WorkspaceResourceDto[]
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(
    query: ListWorkspaceResourcesQuery,
  ): Promise<readonly WorkspaceResourceDto[]> {
    try {
      const candidates = await this.within(query.principal);
      const visible = await Promise.all(
        candidates.map(async (each) =>
          (await this.access.permissionsIn(each.id, query.principal))
            ? each
            : null,
        ),
      );

      return visible
        .filter((each) => each !== null)
        .map(ResourceMapper.workspace);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async within(
    principal: Principal,
  ): Promise<readonly WorkspaceRecord[]> {
    if (principal.kind === 'person') {
      return this.resources.workspacesJoinedBy(principal.userId);
    }

    const own = await this.resources.workspaceWithId(principal.workspaceId);

    return own ? [own] : [];
  }
}
