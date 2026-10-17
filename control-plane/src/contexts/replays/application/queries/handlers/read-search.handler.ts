import type { SearchDetailDto } from '@replays/application/dto/searches.dto';
import type { ReadSearchQuery } from '@replays/application/queries/read-search.query';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { searchDetailView } from '@replays/application/services/search-views';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadSearchHandler
  implements QueryHandlerPort<ReadSearchQuery, SearchDetailDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly healths: SetHealths,
  ) {}

  async execute(query: ReadSearchQuery): Promise<SearchDetailDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const search = await this.access.searchOn(access, query.searchId);
      const replays = await this.replays.ofSearch(search.id);
      const [candidates, pullRequests, standard] = await Promise.all([
        this.candidates.findMany(
          search.proposals.map((each) => each.candidateId),
        ),
        this.pullRequests.ofSearch(search.id),
        this.healths.standardAt(search.station),
      ]);

      return searchDetailView(
        search,
        replays,
        candidates,
        pullRequests,
        standard.minGain,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
