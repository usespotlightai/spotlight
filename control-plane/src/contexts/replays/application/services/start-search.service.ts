import type { HashPort } from '@replays/application/ports/hash.port';
import type { LiveCandidates } from '@replays/application/services/live-candidates.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { LineSearchBudget } from '@replays/domain/aggregates/line-search-budget.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { Search } from '@replays/domain/aggregates/search.aggregate';
import type { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { SearchInProgressError } from '@replays/domain/exceptions/search-in-progress.error';
import { SearchVersionConflictError } from '@replays/domain/exceptions/search-version-conflict.error';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import { UnknownSearchScheduleError } from '@replays/domain/exceptions/unknown-search-schedule.error';
import { UnsearchableRequestError } from '@replays/domain/exceptions/unsearchable-request.error';
import type { LineSearchBudgetRepository } from '@replays/domain/repositories/line-search-budget.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import { monthStartOf } from '@replays/domain/services/search-schedule';
import { unsearchableChanges } from '@replays/domain/services/searchable-changes';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { SearchRequest } from '@replays/domain/value-objects/search-request.vo';
import type { SearchTrigger } from '@replays/domain/value-objects/search-trigger';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface SearchBeginning {
  readonly id: SearchId;
  readonly set: ReplaySet;
  readonly agent: SearchAgent | null;
  readonly budget: SearchBudget;
  readonly calibrates: boolean;
  readonly objective: SearchObjective;
  readonly trigger: SearchTrigger;
  readonly policy: SearchPolicy;
  readonly requested: RequestedCandidate | null;
}

interface RequestedCandidate {
  readonly candidate: Candidate;
  readonly request: SearchRequest;
}

export class StartSearch {
  constructor(
    private readonly snapshots: LiveCandidates,
    private readonly sets: ReplaySetRepository,
    private readonly searches: SearchRepository,
    private readonly schedules: StationSearchScheduleRepository,
    private readonly budgets: LineSearchBudgetRepository,
    private readonly hash: HashPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async begin(beginning: SearchBeginning): Promise<HeldOutSplit> {
    const { requested } = beginning;
    const { stationId } = beginning.set.station;
    const live = await this.snapshots.taken(beginning.set);
    const kept: Candidate[] = [live];
    let admitted = false;
    let before: StationSearchSchedule | null = null;
    const at = this.clock.now();

    try {
      const problems = requested
        ? unsearchableChanges(live.block, requested.candidate.block)
        : [];

      if (problems.length > 0) {
        throw new UnsearchableRequestError(problems);
      }
      if (requested) {
        await this.snapshots.kept(requested.candidate);
        kept.push(requested.candidate);
      }

      await this.admitted(beginning, at);
      admitted = true;

      if (await this.searches.activeAtStation(stationId)) {
        throw new SearchInProgressError(stationId);
      }

      const taken = await this.scheduled(beginning, at);

      before = taken.before;
      await this.started(beginning, live, taken.split, at);

      return taken.split;
    } catch (error) {
      if (before) {
        await this.scheduleWithdrawn(stationId, before);
      }
      if (admitted) {
        await this.admissionWithdrawn(beginning, at);
      }
      for (const each of kept) {
        await this.snapshots.release(each);
      }

      throw error instanceof SearchVersionConflictError &&
        (await this.searches.activeAtStation(stationId))
        ? new SearchInProgressError(stationId)
        : error;
    }
  }

  private admitted(beginning: SearchBeginning, at: Date): Promise<void> {
    const { lineId } = beginning.set.station;

    return this.transaction.inTransaction(async () => {
      const month = monthStartOf(at);
      const found = await this.budgets.locked(lineId, month);
      const budget =
        found ??
        LineSearchBudget.open({
          lineId,
          workspaceId: beginning.set.workspaceId,
          teamId: beginning.set.teamId,
          at,
        });
      const admitted = budget.admit(
        { searchId: beginning.id, ceiling: beginning.budget.ceiling },
        beginning.policy,
        await this.searches.ofLineStartedSince(lineId, month),
      );

      await (found ? this.budgets.save(admitted) : this.budgets.add(admitted));
    });
  }

  private scheduled(
    beginning: SearchBeginning,
    at: Date,
  ): Promise<{ split: HeldOutSplit; before: StationSearchSchedule }> {
    const { set } = beginning;

    return this.transaction.inTransaction(async () => {
      const schedule = await this.schedules.locked(set.station.stationId);

      if (!schedule) {
        throw new UnknownSearchScheduleError(set.station.stationId);
      }

      const split = HeldOutSplit.drawn({
        searchId: beginning.id,
        entries: set.entries,
        hash: (text) => this.hash.sha256(text),
        excluding: schedule.searchedTasks,
      });

      await this.schedules.save(
        schedule.started({
          searched: split.searched.map((each) => each.taskId),
          inSet: set.entries.map((each) => each.taskId),
          at,
          cooldownMilliseconds: beginning.policy.cooldownMilliseconds,
          trigger: beginning.trigger,
        }),
      );

      return { split, before: schedule };
    });
  }

  private started(
    beginning: SearchBeginning,
    live: Candidate,
    split: HeldOutSplit,
    at: Date,
  ): Promise<void> {
    const { id, budget, calibrates, requested } = beginning;

    return this.transaction.inTransaction(async () => {
      const set = await this.sets.locked(beginning.set.id);

      if (!set) {
        throw new UnknownReplaySetError(beginning.set.id.value);
      }
      if (await this.searches.activeAtStation(set.station.stationId)) {
        throw new SearchInProgressError(set.station.stationId);
      }

      await this.searches.add(
        Search.start({
          id,
          set: set.snapshot,
          agent: beginning.agent,
          budget,
          objective: beginning.objective,
          split,
          calibrates,
          seed: { candidate: live, replayId: ReplayId.of(this.ids.generate()) },
          trigger: beginning.trigger,
          requests: requested ? [requested.request] : [],
          at,
          by: ChangeActor.spotlight(set.workspaceId),
        }),
      );
    });
  }

  private scheduleWithdrawn(
    stationId: StationId,
    before: StationSearchSchedule,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const schedule = await this.schedules.locked(stationId);

      if (schedule) {
        await this.schedules.save(schedule.startWithdrawn(before));
      }
    });
  }

  private admissionWithdrawn(
    beginning: SearchBeginning,
    at: Date,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const budget = await this.budgets.locked(
        beginning.set.station.lineId,
        monthStartOf(at),
      );

      if (budget?.admits(beginning.id)) {
        await this.budgets.save(budget.withdrawn(beginning.id));
      }
    });
  }
}
