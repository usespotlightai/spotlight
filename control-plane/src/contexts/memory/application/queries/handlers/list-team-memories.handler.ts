import type { TeamMemoryDto } from '@memory/application/dto/team-memory.dto';
import type {
  MemoryCriteria,
  MemoryListingPort,
} from '@memory/application/ports/memory-listing.port';
import type {
  ListTeamMemoriesQuery,
  MemoryListing,
} from '@memory/application/queries/list-team-memories.query';
import type { MemoryAccess } from '@memory/application/services/memory-access.service';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { parseMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { parseMemoryStatus } from '@memory/domain/value-objects/memory-status';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

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

const textOf = (raw: string | null | undefined): string | null =>
  raw?.trim() || null;

const criteriaOf = (listing: MemoryListing): MemoryCriteria => {
  const kind = textOf(listing.kind);
  const lineId = textOf(listing.lineId);
  const stationId = textOf(listing.stationId);
  const repository = textOf(listing.repository);

  return {
    status: parseMemoryStatus(listing.status ?? 'active'),
    kind: kind ? parseMemoryKind(kind) : null,
    lineId: lineId ? LineId.of(lineId) : null,
    stationId: stationId ? StationId.of(stationId) : null,
    repository: repository ? Repository.of(repository) : null,
    path: pathOf(listing.path),
  };
};

export class ListTeamMemoriesHandler implements QueryHandlerPort<
  ListTeamMemoriesQuery,
  TeamMemoryDto[]
> {
  constructor(
    private readonly access: MemoryAccess,
    private readonly listing: MemoryListingPort,
    private readonly memories: MemoryRepository,
    private readonly views: TeamMemoryViews,
  ) {}

  async execute(query: ListTeamMemoriesQuery): Promise<TeamMemoryDto[]> {
    try {
      const access = await this.access.forTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      return await this.views.summaries(
        await this.memories.findAll(
          await this.listing.listed(access.teamId, criteriaOf(query.listing)),
        ),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
