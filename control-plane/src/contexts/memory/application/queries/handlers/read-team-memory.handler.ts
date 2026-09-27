import type { TeamMemoryDetailDto } from '@memory/application/dto/team-memory.dto';
import type { ReadTeamMemoryQuery } from '@memory/application/queries/read-team-memory.query';
import type { TeamMemoryAtHand } from '@memory/application/services/team-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadTeamMemoryHandler
  implements QueryHandlerPort<ReadTeamMemoryQuery, TeamMemoryDetailDto>
{
  constructor(
    private readonly atHand: TeamMemoryAtHand,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: ReadTeamMemoryQuery): Promise<TeamMemoryDetailDto> {
    try {
      await this.atHand.member(query.teamId, query.viewerId);

      return await this.views.detail(
        await this.atHand.memory(query.teamId, query.memoryId),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
