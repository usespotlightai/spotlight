import type { StationImprovementDto } from '@replays/application/dto/station-improvements.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReadStationImprovementQuery } from '@replays/application/queries/read-station-improvement.query';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { stationImprovementView } from '@replays/application/services/station-improvement-views';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import { improvementOf } from '@replays/domain/services/station-improvement';
import { OPEN_CONFIG_PULL_REQUEST_STATES } from '@replays/domain/value-objects/config-pull-request-state';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadStationImprovementHandler
  implements
    QueryHandlerPort<ReadStationImprovementQuery, StationImprovementDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly schedules: StationSearchScheduleRepository,
    private readonly searches: SearchRepository,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly work: WorkPort,
  ) {}

  async execute(
    query: ReadStationImprovementQuery,
  ): Promise<StationImprovementDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const { lineId, stationId } = await this.access.stationOn(
        access,
        query.lineId,
        query.stationId,
      );
      const [
        set,
        schedule,
        activeSearch,
        newestSearch,
        openPullRequest,
        newestMerged,
        newestFailed,
        live,
      ] = await Promise.all([
        this.sets.ofStation(stationId),
        this.schedules.ofStation(stationId),
        this.searches.activeAtStation(stationId),
        this.searches.newestAtStation(stationId),
        this.pullRequests.newestAtStation(stationId, [
          ...OPEN_CONFIG_PULL_REQUEST_STATES,
        ]),
        this.pullRequests.newestAtStation(stationId, ['merged']),
        this.pullRequests.newestAtStation(stationId, ['failed']),
        this.work.live(lineId, stationId),
      ]);

      return stationImprovementView(
        improvementOf({
          policyEnabled: live?.search?.enabled ?? false,
          set,
          schedule,
          activeSearch,
          newestSearch,
          pickHasPullRequest: await this.pickHasPullRequest(newestSearch),
          openPullRequest,
          newestMerged,
          newestFailed,
        }),
        set,
        schedule,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async pickHasPullRequest(newest: Search | null): Promise<boolean> {
    const picked = newest?.pickedCandidate ?? null;

    return (
      newest !== null &&
      picked !== null &&
      (await this.pullRequests.forCandidate(newest.id, picked)) !== null
    );
  }
}
