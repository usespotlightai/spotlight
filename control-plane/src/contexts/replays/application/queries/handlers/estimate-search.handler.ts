import type { SearchRefused } from '@replays/application/dto/replay-outcomes.dto';
import type { SearchEstimateDto } from '@replays/application/dto/searches.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { EstimateSearchQuery } from '@replays/application/queries/estimate-search.query';
import { spendView } from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import {
  allotmentOf,
  SearchTermsRefusedError,
  searchBudgetOf,
  splitOf,
} from '@replays/application/services/search-terms';
import type { SetNoises } from '@replays/application/services/set-noises.service';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import { estimateOf } from '@replays/domain/services/search-estimate';
import { searchWarningsOf } from '@replays/domain/services/search-warnings';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class EstimateSearchHandler
  implements
    QueryHandlerPort<EstimateSearchQuery, SearchEstimateDto | SearchRefused>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly work: WorkPort,
    private readonly noises: SetNoises,
  ) {}

  async execute(
    query: EstimateSearchQuery,
  ): Promise<SearchEstimateDto | SearchRefused> {
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
      const set = await this.access.setOn(clearance, query.setId);

      if (!set.isAtStation(station.stationId)) {
        throw new UnknownReplaySetError(query.setId);
      }

      const budget = searchBudgetOf(query.budget);
      const split = splitOf(() =>
        HeldOutSplit.costliest(set.entries, (searched, heldOut) =>
          budget.unitsFor(searched, heldOut),
        ),
      );

      allotmentOf(budget, split);

      const timed = await this.work.durations(set.runs);
      const estimate = estimateOf(budget, split, [...timed.values()]);
      const standard = await this.noises.standardAt(set.station);
      const noise =
        (
          await this.noises.ofSets(
            [set],
            new Map([[set.station.stationId, standard]]),
          )
        ).get(set.id.value) ?? null;

      return {
        searchedTasks: split.searchedTasks,
        heldOutTasks: split.heldOutTasks,
        runs: estimate.runs,
        ceiling: spendView(budget.ceiling),
        perReplayAllotments: {
          seed: spendView(estimate.allotment.seed),
          searchReplay: spendView(estimate.allotment.searchReplay),
          heldOutReplay: spendView(estimate.allotment.heldOutReplay),
          agentRun: spendView(estimate.allotment.agentRun),
        },
        estimatedDuration: estimate.ms,
        minGain: standard.minGain,
        warnings: searchWarningsOf(noise, standard.minGain, budget.repeats),
      };
    } catch (error) {
      if (error instanceof SearchTermsRefusedError) {
        return { outcome: 'invalid', problems: error.problems };
      }
      rethrowAsFault(error);
    }
  }
}
