import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { ReadTeamMemoryQuery } from '@memory/application/queries/read-team-memory.query';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { TeamMemoryLoader } from '@memory/application/services/team-memory-loader.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadTeamMemoryHandler
  implements QueryHandlerPort<ReadTeamMemoryQuery, TeamMemoryDetailDto>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly loader: TeamMemoryLoader,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: ReadTeamMemoryQuery): Promise<TeamMemoryDetailDto> {
    try {
      const access = await this.access.forTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      return await this.views.detail(
        await this.loader.memory(access, query.memoryId),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
