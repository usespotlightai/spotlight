import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import type {
  ListTeamMemoriesQuery,
  MemoryListing,
} from '@memory/application/queries/list-team-memories.query';
import type { TeamMemoryAtHand } from '@memory/application/services/team-memory-at-hand.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type {
  MemoryCriteria,
  MemoryRepository,
} from '@memory/domain/repositories/memory.repository';
import { isMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MEMORY_STANDINGS } from '@memory/domain/value-objects/memory-standing';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

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
  const standing =
    MEMORY_STANDINGS.find((each) => each === (listing.standing ?? 'stands')) ??
    null;
  const kind = listing.kind?.trim() || null;

  if (!standing || (kind && !isMemoryKind(kind))) {
    throw new InvalidMemoryError('is listed by a standing and kind it has');
  }

  return {
    standing,
    kind: kind && isMemoryKind(kind) ? kind : null,
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
    private readonly atHand: TeamMemoryAtHand,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: ListTeamMemoriesQuery): Promise<TeamMemoryDto[]> {
    try {
      await this.atHand.member(query.teamId, query.viewerId);

      return await this.views.summaries(
        await this.memories.ofTeam(
          TeamId.of(query.teamId),
          criteriaOf(query.listing),
        ),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
