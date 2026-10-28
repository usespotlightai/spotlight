import type { WorkPort } from '@replays/application/ports/work.port';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { SearchCandidatePicked } from '@replays/domain/events/search-candidate-picked.event';
import type { SearchEnded } from '@replays/domain/events/search-ended.event';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { autoPickOf } from '@replays/domain/services/search-picks';
import { scoresOf } from '@replays/domain/services/search-scores';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class PickSearchCandidates {
  constructor(
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly healths: SetHealths,
    private readonly work: WorkPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async searchEnded(event: SearchEnded): Promise<void> {
    if (event.state !== 'finished') {
      return;
    }

    const seen = await this.searches.find(event.searchId);

    if (!seen || seen.pick !== null) {
      return;
    }

    const standard = await this.healths.standardAt(seen.station);
    const stationThere =
      (await this.work.station(seen.station.lineId, seen.station.stationId)) !==
      null;

    await this.transaction.inTransaction(async () => {
      const search = await this.searches.locked(event.searchId);

      if (search?.current !== 'finished' || search.pick !== null) {
        return;
      }

      const scores = scoresOf(
        search,
        await this.replays.ofSearch(search.id),
        standard.minGain,
      );

      const pick = autoPickOf(scores, search.objective, standard.threshold);

      await this.searches.save(
        search.picked(
          stationThere ? pick : { outcome: 'declined', reason: 'station-gone' },
        ),
      );
    });
  }

  async candidatePicked(event: SearchCandidatePicked): Promise<void> {
    const search = await this.searches.find(event.searchId);
    const proposal = search?.proposals.find((each) =>
      each.candidateId.equals(event.candidateId),
    );

    if (
      !search ||
      !proposal ||
      (await this.pullRequests.forCandidate(search.id, proposal.candidateId))
    ) {
      return;
    }

    const station = await this.work.station(
      search.station.lineId,
      search.station.stationId,
    );

    if (!station) {
      return;
    }

    await this.transaction.inTransaction(() =>
      this.pullRequests.add(
        ConfigPullRequest.pick({
          id: ConfigPullRequestId.of(this.ids.generate()),
          searchId: search.id,
          candidateId: proposal.candidateId,
          station: search.station,
          stationKey: station.key,
          candidateName: proposal.name.value,
          lineKey: station.lineKey,
          source: station.source,
          at: this.clock.now(),
          by: ChangeActor.spotlight(search.workspaceId),
        }),
      ),
    );
  }
}
