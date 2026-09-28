import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { ReadTeamMemoryQuery } from '@memory/application/queries/read-team-memory.query';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { TeamMemoryAtHand } from '@memory/application/services/team-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadTeamMemoryHandler
  implements QueryHandlerPort<ReadTeamMemoryQuery, TeamMemoryDetailDto>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly atHand: TeamMemoryAtHand,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: ReadTeamMemoryQuery): Promise<TeamMemoryDetailDto> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.viewerId,
      );

      return await this.views.detail(
        await this.atHand.memory(clearance, query.memoryId),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
