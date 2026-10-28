import type { StartSearchCommand } from '@replays/application/commands/start-search.command';
import type { SearchStartedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import type { HashPort } from '@replays/application/ports/hash.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import type { RefreshKeptSets } from '@replays/application/services/refresh-kept-sets.service';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import {
  ceilingSplitOf,
  InvalidSearchTermsError,
  searchAgentOf,
  searchBudgetOf,
  splitOf,
} from '@replays/application/services/search-terms';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { SetStations } from '@replays/application/services/set-stations.service';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { Search } from '@replays/domain/aggregates/search.aggregate';
import { SearchInProgressError } from '@replays/domain/exceptions/search-in-progress.error';
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
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

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
    private readonly hash: HashPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly stations: SetStations,
    private readonly healths: SetHealths,
    private readonly refreshing: RefreshKeptSets,
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
      const found = await this.access.setOn(access, command.setId);

      if (!found.isAtStation(station.stationId)) {
        throw new UnknownReplaySetError(command.setId);
      }

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      const agent = searchAgentOf(command.agent, this.work);
      const budget = searchBudgetOf(command.budget);

      await this.stations.stillThere(found);
      await this.refreshing.refreshBefore(found.id);

      const seen = (await this.sets.find(found.id)) ?? found;

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
            throw new SearchInProgressError(set.station.stationId);
          }

          const split = splitOf(() =>
            HeldOutSplit.drawn({
              searchId: id,
              entries: set.entries,
              hash: (text) => this.hash.sha256(text),
            }),
          );
          const ceilingSplit = ceilingSplitOf(budget, split);
          const at = this.clock.now();
          const by = ChangeActor.of(command.actor, set.workspaceId);

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
              ceiling: ceilingSplit.seed,
              unpricedRate: ceilingSplit.perRun,
              at,
              by,
              repeats: budget.repeats,
              searchId: id,
            }),
          );
          await this.sets.save(set.recordSearch());
        });
      } catch (error) {
        await this.snapshots.release(live);
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
      if (error instanceof InvalidSearchTermsError) {
        return { outcome: 'invalid', problems: error.problems };
      }
      rethrowAsApplicationError(error);
    }
  }
}
