import type { SearchSummaryDto } from '@replays/application/dto/searches.dto';
import type { ListSearchesQuery } from '@replays/application/queries/list-searches.query';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SearchSummaries } from '@replays/application/services/search-summaries.service';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListSearchesHandler
  implements QueryHandlerPort<ListSearchesQuery, readonly SearchSummaryDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly searches: SearchRepository,
    private readonly summaries: SearchSummaries,
  ) {}

  async execute(
    query: ListSearchesQuery,
  ): Promise<readonly SearchSummaryDto[]> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const station = await this.access.stationOn(
        clearance,
        query.lineId,
        query.stationId,
      );

      return await this.summaries.of(
        (await this.searches.ofStation(station.stationId)).filter((each) =>
          clearance.sees(each.station),
        ),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
