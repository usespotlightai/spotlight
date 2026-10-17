import type { TeamResourceDto } from '@identity/application/dto/team-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ImportTeamQuery } from '@identity/application/queries/import-team.query';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportTeamHandler
  implements QueryHandlerPort<ImportTeamQuery, TeamResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(query: ImportTeamQuery): Promise<TeamResourceDto | null> {
    try {
      const membership = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const record = membership
        ? await this.resources.teamAt(
            membership.workspaceId,
            TeamKey.of(query.address).value,
          )
        : null;

      return record ? ResourceMapper.team(record) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
