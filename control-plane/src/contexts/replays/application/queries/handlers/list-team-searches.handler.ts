import type { SearchSummaryDto } from '@replays/application/dto/searches.dto';
import type { ListTeamSearchesQuery } from '@replays/application/queries/list-team-searches.query';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SearchSummaries } from '@replays/application/services/search-summaries.service';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListTeamSearchesHandler
  implements
    QueryHandlerPort<ListTeamSearchesQuery, readonly SearchSummaryDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly searches: SearchRepository,
    private readonly summaries: SearchSummaries,
  ) {}

  async execute(
    query: ListTeamSearchesQuery,
  ): Promise<readonly SearchSummaryDto[]> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);

      return await this.summaries.of(
        (
          await this.searches.pageOfTeam(access.teamId, {
            before: query.page.before ? SearchId.of(query.page.before) : null,
            limit: query.page.limit,
          })
        ).filter((each) => access.sees(each.station)),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
