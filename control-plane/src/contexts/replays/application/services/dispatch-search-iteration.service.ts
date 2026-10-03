import type {
  SearchRunQueued,
  WorkPort,
} from '@replays/application/ports/work.port';
import { SearchBriefing } from '@replays/application/rendering/search-briefing';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const UNBRIEFED: SearchRunQueued = {
  queued: false,
  reason: 'its station or the config it started from is gone',
};

export class DispatchSearchIteration {
  constructor(
    private readonly searches: SearchRepository,
    private readonly candidates: CandidateRepository,
    private readonly work: WorkPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async wanted(searchId: SearchId): Promise<void> {
    const search = await this.searches.find(searchId);
    const iteration = search?.wantedIteration ?? null;

    if (!search || !iteration) {
      return;
    }

    const briefing = await this.briefingFor(search, iteration);
    const queued = briefing
      ? await this.work.dispatchSearch({
          run: iteration.runId,
          searchId: search.id,
          iteration: iteration.number,
          lineId: search.station.lineId,
          stationId: search.station.stationId,
          agent: search.agent,
          briefing,
        })
      : UNBRIEFED;
    const stillWanted = await this.transaction.run(async () => {
      const fresh = await this.searches.locked(search.id);

      if (!fresh) {
        return false;
      }

      const changed = queued.queued
        ? fresh.runQueued(iteration.runId)
        : fresh.runEnded(
            iteration.runId,
            { failed: true, started: false },
            this.clock.now(),
            () => RunId.of(this.ids.generate()),
          );

      if (changed !== fresh) {
        await this.searches.save(changed);
      }

      return changed.heldRun?.equals(iteration.runId) ?? false;
    });

    if (queued.queued && !stillWanted) {
      await this.work.withdrawSearch(iteration.runId);
    }
  }

  private async briefingFor(
    search: Search,
    iteration: SearchIteration,
  ): Promise<string | null> {
    const station = await this.work.station(
      search.station.lineId,
      search.station.stationId,
    );
    const [seed] = await this.candidates.findMany([search.seed.candidateId]);

    if (!station || !seed) {
      return null;
    }

    const ceiling = search.budget.ceiling;
    const left = ceiling.amount - search.spent.amount;

    return SearchBriefing.of({
      stationKey: station.key,
      stationName: station.name,
      lineKey: station.lineKey,
      seed: seed.block,
      iteration: iteration.number,
      iterations: search.budget.iterations,
      perIteration: search.budget.perIteration,
      left: Spend.of(Math.max(0, left), ceiling.currency),
      ceiling,
      searchedTasks: search.split.searchedTasks,
      heldOutTasks: search.split.heldOutTasks,
      objective: search.objective,
    });
  }
}
