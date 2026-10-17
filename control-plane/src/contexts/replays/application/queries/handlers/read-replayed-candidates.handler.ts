import type { ReplayedCandidatesDto } from '@replays/application/dto/replayed-candidates.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReadReplayedCandidatesQuery } from '@replays/application/queries/read-replayed-candidates.query';
import { replayedCandidatesView } from '@replays/application/services/replayed-candidate-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-reading';
import { UNREAD_HEALTH } from '@replays/domain/services/set-health';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayedPeriod } from '@replays/domain/value-objects/replayed-period.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export const MAX_REPLAYED = 500;

const distinct = (values: readonly string[]): readonly string[] => [
  ...new Set(values),
];

export class ReadReplayedCandidatesHandler
  implements
    QueryHandlerPort<ReadReplayedCandidatesQuery, ReplayedCandidatesDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly replays: ReplayRepository,
    private readonly searches: SearchRepository,
    private readonly sets: ReplaySetRepository,
    private readonly candidates: CandidateRepository,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly work: WorkPort,
    private readonly clock: ClockPort,
    private readonly healths: SetHealths,
  ) {}

  async execute(
    query: ReadReplayedCandidatesQuery,
  ): Promise<ReplayedCandidatesDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const period = ReplayedPeriod.of(query.period, this.clock.now());
      const found = await this.replays.ofTeamStartedSince(
        access.teamId,
        period.from,
        MAX_REPLAYED + 1,
      );
      const recent = found
        .slice(0, MAX_REPLAYED)
        .filter((each) => access.sees(each.station));
      const setIds = distinct(recent.map((each) => each.setId.value)).map(
        (each) => ReplaySetId.of(each),
      );
      const [sets, linked, startedIn] = await Promise.all([
        this.sets.findMany(setIds),
        this.searches.findMany(
          distinct(
            recent.flatMap((each) =>
              each.searchId ? [each.searchId.value] : [],
            ),
          ).map((each) => SearchId.of(each)),
        ),
        this.searches.ofSetsStartedSince(setIds, period.from),
      ]);
      const searches = [
        ...new Map(
          [...linked, ...startedIn]
            .filter((each) => access.sees(each.station))
            .map((each) => [each.id.value, each]),
        ).values(),
      ];
      const seen = sets.filter((each) => access.sees(each.station));
      const [searchReplays, baselines, pullRequests] = await Promise.all([
        this.replays.ofSearches(searches.map((each) => each.id)),
        this.replays.baselinesOfSets(seen.map((each) => each.id)),
        this.pullRequests.ofSearches(searches.map((each) => each.id)),
      ]);
      const [candidates, standing] = await Promise.all([
        this.candidates.findMany(
          distinct([
            ...recent.map((each) => each.candidateId.value),
            ...baselines.map((each) => each.candidateId.value),
            ...searches.flatMap((each) =>
              each.proposals.map((proposal) => proposal.candidateId.value),
            ),
          ]).map((each) => CandidateId.of(each)),
        ),
        this.work.standing(
          access.workspaceId,
          seen.flatMap((each) => each.runs),
        ),
      ]);

      const live = await this.healths.standardsAt(
        seen.map((each) => each.station),
      );
      const healths = await this.healths.ofSets(seen, live);
      const standards = new Map(
        seen.map((set) => [
          set.id.value,
          {
            health: healths.get(set.id.value) ?? UNREAD_HEALTH,
            minGain:
              live.get(set.station.stationId)?.minGain ?? DEFAULT_MIN_GAIN,
          },
        ]),
      );

      return replayedCandidatesView({
        period,
        truncated: found.length > MAX_REPLAYED,
        recent,
        searches,
        searchReplays,
        sets: seen,
        baselines,
        candidates,
        pullRequests,
        standing,
        standards,
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
