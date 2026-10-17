import type { StartSearchCommand } from '@replays/application/commands/start-search.command';
import type { SearchStartedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import type { DigestPort } from '@replays/application/ports/digest.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import {
  allotmentOf,
  SearchTermsRefusedError,
  searchAgentOf,
  searchBudgetOf,
  splitOf,
} from '@replays/application/services/search-terms';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { SetStations } from '@replays/application/services/set-stations.service';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { Search } from '@replays/domain/aggregates/search.aggregate';
import { SearchUnderwayError } from '@replays/domain/exceptions/search-underway.error';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { objectiveFor } from '@replays/domain/services/search-objective';
import { searchWarningsOf } from '@replays/domain/services/search-warnings';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class StartSearchHandler
  implements CommandHandlerPort<StartSearchCommand, SearchStartedOutcome>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly work: WorkPort,
    private readonly snapshots: LiveSnapshots,
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly searches: SearchRepository,
    private readonly digest: DigestPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly stations: SetStations,
    private readonly healths: SetHealths,
  ) {}

  async execute(command: StartSearchCommand): Promise<SearchStartedOutcome> {
    try {
      const access = await this.access.forTeam(
        command.teamId,
        command.actor.principal,
      );
      const station = await this.access.stationOn(
        access,
        command.lineId,
        command.stationId,
      );
      const seen = await this.access.setOn(access, command.setId);

      if (!seen.isAtStation(station.stationId)) {
        throw new UnknownReplaySetError(command.setId);
      }

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      const agent = searchAgentOf(command.agent, this.work);
      const budget = searchBudgetOf(command.budget);

      await this.stations.stillThere(seen);

      const id = SearchId.of(this.ids.generate());
      const seedId = ReplayId.of(this.ids.generate());
      const standard = await this.healths.standardAt(seen.station);
      const health = await this.healths.ofSet(seen, standard);
      const objective = objectiveFor(command.objective, health);
      const live = await this.snapshots.taken(seen);

      try {
        await this.transaction.inTransaction(async () => {
          const set = await this.sets.locked(seen.id);

          if (!set) {
            throw new UnknownReplaySetError(command.setId);
          }
          if (
            (await this.searches.activeOfSet(set.id)) ||
            (await this.searches.activeAtStation(set.station.stationId))
          ) {
            throw new SearchUnderwayError(set.station.stationId);
          }

          const split = splitOf(() =>
            HeldOutSplit.drawn({
              searchId: id,
              entries: set.entries,
              digest: (text) => this.digest.sha256(text),
            }),
          );
          const allotment = allotmentOf(budget, split);
          const at = this.clock.now();
          const by = Attribution.of(command.actor, set.workspaceId);

          await this.searches.add(
            Search.start({
              id,
              set,
              agent,
              budget,
              objective,
              split,
              seed: { candidate: live, replayId: seedId },
              at,
              by,
            }),
          );
          await this.replays.add(
            Replay.start({
              id: seedId,
              set,
              candidate: live,
              baseline: true,
              ceiling: allotment.seed,
              unpricedRate: allotment.perRun,
              at,
              by,
              repeats: budget.repeats,
              searchId: id,
            }),
          );
          await this.sets.save(set.recordSearch());
        });
      } catch (error) {
        await this.snapshots.letGo(live);
        throw error;
      }

      return {
        outcome: 'started',
        id: id.value,
        seedReplayId: seedId.value,
        objective,
        warnings: searchWarningsOf(health, standard.minGain, budget.repeats),
      };
    } catch (error) {
      if (error instanceof SearchTermsRefusedError) {
        return { outcome: 'invalid', problems: error.problems };
      }
      rethrowAsApplicationError(error);
    }
  }
}
