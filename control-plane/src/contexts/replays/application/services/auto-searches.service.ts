import type { HashPort } from '@replays/application/ports/hash.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { RefreshKeptSets } from '@replays/application/services/refresh-kept-sets.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { StartSearch } from '@replays/application/services/start-search.service';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { MonthlyCeilingReachedError } from '@replays/domain/exceptions/monthly-ceiling-reached.error';
import { NoFreshHeldOutError } from '@replays/domain/exceptions/no-fresh-held-out.error';
import { SearchInCooldownError } from '@replays/domain/exceptions/search-in-cooldown.error';
import { SearchInProgressError } from '@replays/domain/exceptions/search-in-progress.error';
import { SearchSetTooSmallError } from '@replays/domain/exceptions/search-set-too-small.error';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import { objectiveFor } from '@replays/domain/services/search-objective';
import {
  BUSY_RECHECK_MS,
  dueVerdict,
  monthSpentOf,
  monthStartOf,
  nextMonthStartOf,
  SET_RECHECK_MS,
  setVerdict,
} from '@replays/domain/services/search-schedule';
import { searchWarningsOf } from '@replays/domain/services/search-warnings';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import type { Money } from '@replays/domain/value-objects/money.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';
import type { SearchTrigger } from '@replays/domain/value-objects/search-trigger';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const DUE_PER_TICK = 20;

const after = (at: Date, ms: number): Date => new Date(at.getTime() + ms);

type SplitReading = 'too-small' | 'no-fresh' | HeldOutSplit;

export class AutoSearches implements PendingJobsPort {
  readonly name = 'AutoSearches';

  constructor(
    private readonly schedules: StationSearchScheduleRepository,
    private readonly sets: ReplaySetRepository,
    private readonly searches: SearchRepository,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly refreshing: RefreshKeptSets,
    private readonly healths: SetHealths,
    private readonly starting: StartSearch,
    private readonly work: WorkPort,
    private readonly hash: HashPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    for (const stationId of await this.schedules.dueStations(
      this.clock.now(),
      DUE_PER_TICK,
    )) {
      try {
        const due = await this.schedules.ofStation(stationId);

        if (due) {
          await this.looked(due);
        }
      } catch (error) {
        this.logger.warn(
          { stationId, error },
          'An automatic search could not be started. Spotlight tries again later.',
        );
      }
    }
  }

  private async looked(due: StationSearchSchedule): Promise<void> {
    try {
      await this.look(due);
    } catch (error) {
      await this.changed(due, (schedule) =>
        schedule.postponed(after(this.clock.now(), BUSY_RECHECK_MS)),
      );
      throw error;
    }
  }

  private async look(due: StationSearchSchedule): Promise<void> {
    const now = this.clock.now();
    const set = await this.sets.find(due.setId);

    if (!set || set.isAtGoneStation) {
      await this.changed(due, (schedule) =>
        schedule.postponed(after(now, SET_RECHECK_MS)),
      );
      return;
    }

    const { lineId, stationId } = set.station;
    const live = await this.work.live(lineId, stationId);
    const policy = live?.search ?? null;
    const verdict = dueVerdict({
      policy,
      scores:
        live !== null && (live.scoring.judges || live.scoring.checksChanges),
      lastStartedAt: due.lastStartedAt,
      cooldownFrom: due.cooldownFrom,
      alertPendingSince: due.alertPendingSince,
      now,
      busy: await this.busy(stationId),
      pullRequestOpen: await this.pullRequests.openAtStation(stationId),
      monthSpent: policy && (await this.monthSpent(lineId, policy, now)),
    });

    if (verdict.kind === 'wait') {
      await this.changed(due, (schedule) =>
        schedule.postponed(verdict.checkAfter),
      );
      return;
    }
    if (verdict.kind === 'skip') {
      await this.skipped(due, verdict.reason, verdict.checkAfter);
      return;
    }

    await this.attempt(
      due,
      set,
      verdict.policy,
      live?.agent ?? null,
      verdict.trigger,
    );
  }

  private async busy(stationId: string): Promise<boolean> {
    const searches = await this.searches.ofStation(stationId);
    const [last] = [...searches].sort(
      (one, other) => other.startedAt.getTime() - one.startedAt.getTime(),
    );
    const picked = last?.pickedCandidate ?? null;

    return (
      searches.some((each) => each.isActive) ||
      (last?.awaitsPick ?? false) ||
      (last !== undefined &&
        picked !== null &&
        (await this.pullRequests.forCandidate(last.id, picked)) === null)
    );
  }

  private async attempt(
    due: StationSearchSchedule,
    found: ReplaySet,
    policy: SearchPolicy,
    stationAgent: SearchAgent | null,
    trigger: SearchTrigger,
  ): Promise<void> {
    await this.refreshing.refreshBefore(found.id);

    const set = (await this.sets.find(found.id)) ?? found;
    const standard = await this.healths.standardAt(set.station);
    const health = await this.healths.ofSet(set, standard);
    const budget = SearchBudget.automatic({
      ceiling: policy.ceiling,
      iterations: policy.iterations,
      repeats: policy.repeats,
    });
    const id = SearchId.of(this.ids.generate());
    const split = this.splitOf(id, set, due);
    const verdict = setVerdict({
      now: this.clock.now(),
      tooSmall: split === 'too-small',
      warnings: searchWarningsOf(health, standard.minGain, budget.repeats),
      freshHeldOut: split !== 'no-fresh',
      affordable: typeof split === 'string' || budget.affords(split),
      agent: this.agentOf(policy, stationAgent),
    });

    if (verdict.kind === 'skip') {
      await this.skipped(due, verdict.reason, verdict.checkAfter);
      return;
    }

    try {
      await this.starting.begin({
        id,
        set,
        agent: verdict.agent,
        budget,
        objective: objectiveFor(policy.objective, health),
        trigger,
        policy,
      });
    } catch (error) {
      if (error instanceof MonthlyCeilingReachedError) {
        await this.skipped(
          due,
          'monthly-ceiling',
          nextMonthStartOf(this.clock.now()),
        );
        return;
      }
      if (
        !(error instanceof SearchInProgressError) &&
        !(error instanceof SearchInCooldownError)
      ) {
        throw error;
      }

      await this.changed(due, (schedule) =>
        schedule.postponed(after(this.clock.now(), BUSY_RECHECK_MS)),
      );
    }
  }

  private splitOf(
    id: SearchId,
    set: ReplaySet,
    schedule: StationSearchSchedule,
  ): SplitReading {
    try {
      return HeldOutSplit.drawn({
        searchId: id,
        entries: set.entries,
        hash: (text) => this.hash.sha256(text),
        excluding: schedule.searchedTasks,
      });
    } catch (error) {
      if (error instanceof SearchSetTooSmallError) {
        return 'too-small';
      }
      if (error instanceof NoFreshHeldOutError) {
        return 'no-fresh';
      }
      throw error;
    }
  }

  private async monthSpent(
    lineId: string,
    policy: SearchPolicy,
    now: Date,
  ): Promise<Money> {
    return monthSpentOf(
      await this.searches.ofLineStartedSince(lineId, monthStartOf(now)),
      policy.monthlyCeiling.currency,
    );
  }

  private agentOf(
    policy: SearchPolicy,
    stationAgent: SearchAgent | null,
  ): SearchAgent | null {
    const agent = policy.agent ?? stationAgent;

    return agent && !this.work.agentProblem(agent) ? agent : null;
  }

  private skipped(
    due: StationSearchSchedule,
    reason: SearchSkipReason,
    checkAfter: Date,
  ): Promise<void> {
    return this.changed(due, (schedule) =>
      schedule.skipped(reason, this.clock.now(), checkAfter),
    );
  }

  private changed(
    evaluated: StationSearchSchedule,
    change: (schedule: StationSearchSchedule) => StationSearchSchedule,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const schedule = await this.schedules.locked(evaluated.stationId);

      if (schedule && schedule.version === evaluated.version) {
        await this.schedules.save(change(schedule));
      }
    });
  }
}
