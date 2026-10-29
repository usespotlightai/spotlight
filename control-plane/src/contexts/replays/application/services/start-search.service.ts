import type { HashPort } from '@replays/application/ports/hash.port';
import type { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { Search } from '@replays/domain/aggregates/search.aggregate';
import { MonthlyCeilingReachedError } from '@replays/domain/exceptions/monthly-ceiling-reached.error';
import { SearchInProgressError } from '@replays/domain/exceptions/search-in-progress.error';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import { UnknownSearchScheduleError } from '@replays/domain/exceptions/unknown-search-schedule.error';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import {
  fitsMonth,
  monthSpentOf,
  monthStartOf,
} from '@replays/domain/services/search-schedule';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { SearchTrigger } from '@replays/domain/value-objects/search-trigger';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export interface SearchBeginning {
  readonly id: SearchId;
  readonly set: ReplaySet;
  readonly agent: SearchAgent;
  readonly budget: SearchBudget;
  readonly calibrates: boolean;
  readonly objective: SearchObjective;
  readonly trigger: SearchTrigger;
  readonly policy: SearchPolicy;
}

export class StartSearch {
  constructor(
    private readonly snapshots: LiveSnapshots,
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly searches: SearchRepository,
    private readonly schedules: StationSearchScheduleRepository,
    private readonly hash: HashPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async begin(beginning: SearchBeginning): Promise<void> {
    const { id, budget, calibrates } = beginning;
    const seedId = ReplayId.of(this.ids.generate());
    const live = await this.snapshots.taken(beginning.set);

    try {
      await this.transaction.inTransaction(async () => {
        const { lineId, stationId } = beginning.set.station;
        const at = this.clock.now();
        const monthSpent = monthSpentOf(
          await this.searches.lockedOfLineStartedSince(
            lineId,
            monthStartOf(at),
          ),
          beginning.policy.monthlyCeiling.currency,
        );

        if (!fitsMonth(beginning.policy, monthSpent)) {
          throw new MonthlyCeilingReachedError(lineId);
        }

        const set = await this.sets.locked(beginning.set.id);
        const schedule = await this.schedules.locked(stationId);

        if (!set) {
          throw new UnknownReplaySetError(beginning.set.id.value);
        }
        if (!schedule) {
          throw new UnknownSearchScheduleError(stationId);
        }
        if (
          (await this.searches.activeOfSet(set.id)) ||
          (await this.searches.activeAtStation(set.station.stationId))
        ) {
          throw new SearchInProgressError(set.station.stationId);
        }

        const split = HeldOutSplit.drawn({
          searchId: id,
          entries: set.entries,
          hash: (text) => this.hash.sha256(text),
          excluding: schedule.searchedTasks,
        });
        const ceilingSplit = budget.splitCeiling(split, calibrates);
        const by = ChangeActor.spotlight(set.workspaceId);

        await this.searches.add(
          Search.start({
            id,
            set,
            agent: beginning.agent,
            budget,
            objective: beginning.objective,
            split,
            calibrates,
            seed: { candidate: live, replayId: seedId },
            trigger: beginning.trigger,
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
            repeats: budget.seedRepeats(calibrates),
            calibration: calibrates,
            searchId: id,
          }),
        );
        await this.sets.save(set.recordSearch());
        await this.schedules.save(
          schedule.started({
            searched: split.searched.map((each) => each.taskId),
            inSet: set.entries.map((each) => each.taskId),
            at,
            cooldownMilliseconds: beginning.policy.cooldownMilliseconds,
          }),
        );
      });
    } catch (error) {
      await this.snapshots.release(live);
      throw error;
    }
  }
}
