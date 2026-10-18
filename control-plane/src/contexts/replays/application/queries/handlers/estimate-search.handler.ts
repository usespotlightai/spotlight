import type { SearchRejected } from '@replays/application/dto/replay-outcomes.dto';
import type { SearchEstimateDto } from '@replays/application/dto/searches.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { EstimateSearchQuery } from '@replays/application/queries/estimate-search.query';
import { moneyView } from '@replays/application/services/replay-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import {
  ceilingSplitOf,
  InvalidSearchTermsError,
  searchBudgetOf,
  splitOf,
} from '@replays/application/services/search-terms';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import { estimateOf } from '@replays/domain/services/search-estimate';
import { objectiveFor } from '@replays/domain/services/search-objective';
import { searchWarningsOf } from '@replays/domain/services/search-warnings';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class EstimateSearchHandler
  implements
    QueryHandlerPort<EstimateSearchQuery, SearchEstimateDto | SearchRejected>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly work: WorkPort,
    private readonly healths: SetHealths,
  ) {}

  async execute(
    query: EstimateSearchQuery,
  ): Promise<SearchEstimateDto | SearchRejected> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const station = await this.access.stationOn(
        access,
        query.lineId,
        query.stationId,
      );
      const set = await this.access.setOn(access, query.setId);

      if (!set.isAtStation(station.stationId)) {
        throw new UnknownReplaySetError(query.setId);
      }

      const budget = searchBudgetOf(query.budget);
      const split = splitOf(() =>
        HeldOutSplit.costliest(set.entries, (searched, heldOut) =>
          budget.unitsFor(searched, heldOut),
        ),
      );

      ceilingSplitOf(budget, split);

      const timed = await this.work.durations(set.runs);
      const estimate = estimateOf(budget, split, [...timed.values()]);
      const standard = await this.healths.standardAt(set.station);
      const health = await this.healths.ofSet(set, standard);

      return {
        searchedTasks: split.searchedTasks,
        heldOutTasks: split.heldOutTasks,
        runs: estimate.runs,
        ceiling: moneyView(budget.ceiling),
        perReplayLimits: {
          seed: moneyView(estimate.ceilingSplit.seed),
          searchReplay: moneyView(estimate.ceilingSplit.searchReplay),
          heldOutReplay: moneyView(estimate.ceilingSplit.heldOutReplay),
          agentRun: moneyView(estimate.ceilingSplit.agentRun),
        },
        estimatedDuration: estimate.ms,
        minGain: standard.minGain,
        objective: objectiveFor(query.objective, health),
        warnings: searchWarningsOf(health, standard.minGain, budget.repeats),
      };
    } catch (error) {
      if (error instanceof InvalidSearchTermsError) {
        return { outcome: 'invalid', problems: error.problems };
      }
      rethrowAsApplicationError(error);
    }
  }
}
