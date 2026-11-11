import type { ReplayedCandidatesDto } from '@replays/application/dto/replayed-candidates.dto';
import type { ReplayedCandidatesReaderPort } from '@replays/application/ports/replayed-candidates-reader.port';
import type { TrialableRunsPort } from '@replays/application/ports/trialable-runs.port';
import type { ReadReplayedCandidatesQuery } from '@replays/application/queries/read-replayed-candidates.query';
import { replayedCandidatesView } from '@replays/application/queries/views/replayed-candidate-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import {
  HEALTH_SAMPLES_PER_GROUP,
  healthReplaysOf,
  healthSamplesOf,
  missingReferencesOf,
  setHealthOf,
} from '@replays/domain/services/set-health';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayedPeriod } from '@replays/domain/value-objects/replayed-period.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const MAX_REPLAYED = 500;

const distinct = <T extends { readonly value: string }>(
  values: readonly T[],
): readonly T[] => [
  ...new Map(values.map((each) => [each.value, each])).values(),
];

export class ReadReplayedCandidatesHandler implements QueryHandlerPort<
  ReadReplayedCandidatesQuery,
  ReplayedCandidatesDto
> {
  constructor(
    private readonly access: ReplaysAccess,
    private readonly reader: ReplayedCandidatesReaderPort,
    private readonly trialableRuns: TrialableRunsPort,
    private readonly clock: ClockPort,
    private readonly healths: SetHealths,
  ) {}

  async execute(
    query: ReadReplayedCandidatesQuery,
  ): Promise<ReplayedCandidatesDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const period = ReplayedPeriod.of(query.period, this.clock.now());
      const found = await this.reader.startedOfTeamSince(
        access.teamId,
        period.from,
        MAX_REPLAYED + 1,
      );
      const recent = found
        .slice(0, MAX_REPLAYED)
        .filter((each) => access.sees(each.station));
      const setIds: readonly ReplaySetId[] = distinct(
        recent.map((each) => each.setId),
      );
      const [sets, linked, startedIn] = await Promise.all([
        this.reader.sets(setIds),
        this.reader.searches(
          distinct(
            recent.flatMap((each): SearchId[] =>
              each.searchId ? [each.searchId] : [],
            ),
          ),
        ),
        this.reader.searchesOfSetsStartedSince(setIds, period.from),
      ]);
      const searches = [
        ...new Map(
          [...linked, ...startedIn]
            .filter((each) => access.sees(each.station))
            .map((each) => [each.id.value, each]),
        ).values(),
      ];
      const seen = sets.filter((each) => access.sees(each.station));
      const seenIds = seen.map((each) => each.id);
      const [searchReplays, baselines, pullRequests, read, live] =
        await Promise.all([
          this.reader.outcomesOfSearches(searches.map((each) => each.id)),
          this.reader.servingBaselinesOfSets(seenIds),
          this.reader.pullRequestsOfSearches(searches.map((each) => each.id)),
          this.reader
            .healthSamplesOfSets(seenIds, HEALTH_SAMPLES_PER_GROUP)
            .then(healthSamplesOf),
          this.healths.standardsAt(seen.map((each) => each.station)),
        ]);
      const references = await this.reader.outcomes(missingReferencesOf(read));
      const sampled = [...read, ...references];
      const [candidates, summaries] = await Promise.all([
        this.reader.candidates(
          distinct<CandidateId>([
            ...recent.map((each) => each.candidateId),
            ...baselines.map((each) => each.candidateId),
            ...searches.flatMap((each) =>
              each.proposals.map((proposal) => proposal.candidateId),
            ),
            ...sampled.map((each) => each.candidateId),
          ]),
        ),
        this.trialableRuns.runSummaries(
          access.workspaceId,
          seen.flatMap((each) => each.runs),
        ),
      ]);
      const standards = new Map(
        seen.map((set) => {
          const standard = live.get(set.station.stationId.value);

          if (!standard) {
            throw new InconsistentStateError(
              'replayed candidates',
              `read no live standard for station ${set.station.stationId.value}`,
            );
          }

          return [
            set.id.value,
            {
              health: setHealthOf(
                healthReplaysOf(read, references, set.id),
                candidates,
                standard.fingerprint,
                standard.minGain,
              ),
              minGain: standard.minGain,
            },
          ];
        }),
      );

      return replayedCandidatesView({
        period,
        truncated: found.length > MAX_REPLAYED,
        searches,
        searchReplays,
        sets: seen,
        baselines,
        candidates,
        pullRequests,
        summaries,
        standards,
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
