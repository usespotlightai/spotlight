import type { TeamResourceDto } from '@identity/application/dto/team-resource.dto';
import { ResourceMapper } from '@identity/application/mappers/resource.mapper';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ReadTeamQuery } from '@identity/application/queries/read-team.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ReadTeamHandler
  implements QueryHandlerPort<ReadTeamQuery, TeamResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: IdentityResourcesPort,
  ) {}

  async execute(query: ReadTeamQuery): Promise<TeamResourceDto | null> {
    try {
      const record = await this.resources.teamWithId(TeamId.of(query.teamId));

      return record &&
        (await this.access.permissionsIn(record.workspaceId, query.principal))
        ? ResourceMapper.team(record)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
