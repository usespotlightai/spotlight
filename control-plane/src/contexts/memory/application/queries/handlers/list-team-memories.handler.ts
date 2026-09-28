import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import type {
  ListTeamMemoriesQuery,
  MemoryListing,
} from '@memory/application/queries/list-team-memories.query';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type {
  MemoryCriteria,
  MemoryRepository,
} from '@memory/domain/repositories/memory.repository';
import { parseMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { parseMemoryStanding } from '@memory/domain/value-objects/memory-standing';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const pathOf = (raw: string | null): string | null => {
  try {
    return raw?.trim() ? MemoryPath.of(raw).value : null;
  } catch (error) {
    if (error instanceof InvalidMemoryError) {
      return null;
    }
    throw error;
  }
};

const criteriaOf = (listing: MemoryListing): MemoryCriteria => {
  const kind = listing.kind?.trim() || null;

  return {
    standing: parseMemoryStanding(listing.standing ?? 'stands'),
    kind: kind ? parseMemoryKind(kind) : null,
    lineId: listing.lineId?.trim() || null,
    stationId: listing.stationId?.trim() || null,
    repository: listing.repository?.trim() || null,
    path: pathOf(listing.path),
  };
};

export class ListTeamMemoriesHandler
  implements QueryHandlerPort<ListTeamMemoriesQuery, TeamMemoryDto[]>
{
  constructor(
    private readonly access: MemoryAccess,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: ListTeamMemoriesQuery): Promise<TeamMemoryDto[]> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.viewerId,
      );

      return await this.views.summaries(
        await this.memories.ofTeam(clearance.teamId, criteriaOf(query.listing)),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
