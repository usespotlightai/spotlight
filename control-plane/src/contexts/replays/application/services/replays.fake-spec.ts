import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { InsightsPort } from '@replays/application/ports/insights.port';
import type {
  LinesPort,
  NamedStation,
  SearchedStation,
  StationSettings,
  StationView,
} from '@replays/application/ports/lines.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type {
  ReplayedCandidateRow,
  ReplayedCandidatesReaderPort,
} from '@replays/application/ports/replayed-candidates-reader.port';
import type { AgentProblem } from '@replays/application/ports/runs.port';
import type { StartingPointHoldsPort } from '@replays/application/ports/starting-point-holds.port';
import type {
  CandidateValidation,
  LiveStationConfig,
  StationConfigCandidatesPort,
} from '@replays/application/ports/station-config-candidates.port';
import type {
  PickableRun,
  RunReplayability,
  TrialableRunsPort,
} from '@replays/application/ports/trialable-runs.port';
import { LiveCandidates } from '@replays/application/services/live-candidates.service';
import { PendingSearchSteps } from '@replays/application/services/pending-search-steps.service';
import { RefreshReplaySets } from '@replays/application/services/refresh-replay-sets.service';
import type {
  CancelledRun,
  OracleAnswerInput,
  ReplayRunDispatching,
  ReplayRunOrder,
  ReplayRunQueued,
} from '@replays/application/services/replay-run-dispatch.service';
import { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type {
  LeasedSearchRun,
  SearchRunDispatching,
  SearchRunOrder,
  SearchRunQueued,
  SearchRunStatus,
  UnclaimedCancellation,
} from '@replays/application/services/search-run-dispatch.service';
import { SetUsage } from '@replays/application/services/set-usage.service';
import { StartSearchReplays } from '@replays/application/services/start-search-replays.service';
import {
  type LiveConfig,
  StationConfigs,
} from '@replays/application/services/station-configs.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import { LineSearchBudget } from '@replays/domain/aggregates/line-search-budget.aggregate';
import { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import {
  ReplayRunDecision,
  type ReplayRunOwner,
} from '@replays/domain/aggregates/replay-run-decision.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import type { SearchReplaysPlanned } from '@replays/domain/events/search-replays-planned.event';
import { ConfigPullRequestVersionConflictError } from '@replays/domain/exceptions/config-pull-request-version-conflict.error';
import { LineSearchBudgetVersionConflictError } from '@replays/domain/exceptions/line-search-budget-version-conflict.error';
import { ReplayCheckVersionConflictError } from '@replays/domain/exceptions/replay-check-version-conflict.error';
import { ReplayRunDecisionVersionConflictError } from '@replays/domain/exceptions/replay-run-decision-version-conflict.error';
import { ReplayVersionConflictError } from '@replays/domain/exceptions/replay-version-conflict.error';
import { StationSearchScheduleVersionConflictError } from '@replays/domain/exceptions/station-search-schedule-version-conflict.error';
import {
  FINGERPRINT,
  HASHES,
  LIVE_FINGERPRINT,
  LIVE_HASHES,
  NOW,
  STATION,
  UNSCORED,
} from '@replays/domain/replays.fake-spec';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { LineSearchBudgetRepository } from '@replays/domain/repositories/line-search-budget.repository';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplayRunDecisionRepository } from '@replays/domain/repositories/replay-run-decision.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { StackStatus } from '@replays/domain/value-objects/change-checks.vo';
import { ChangeStackId } from '@replays/domain/value-objects/change-stack-id.vo';
import type { CheckedChange } from '@replays/domain/value-objects/checked-change.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const PERSON: Principal = PersonPrincipal.of(UserId.of('user_1'));

export const ACTOR: Actor = actorFor('user_1');

export const STATION_VIEW: StationView = {
  ...STATION,
  lineKey: 'delivery',
  key: 'build',
  name: 'Build',
  source: {
    repository: Repository.of('acme/platform'),
    path: 'teams/core/delivery.tf',
  },
};

export const candidateRowOf = (candidate: Candidate): ReplayedCandidateRow => ({
  id: candidate.id,
  isLive: candidate.isLive,
  isOracle: candidate.isOracle,
  fingerprint: candidate.fingerprint,
  basedOn: candidate.basedOn,
  hypothesis: candidate.search?.hypothesis ?? null,
  changes: candidate.changedFrom.changes,
});

export class InMemoryReplays {
  readonly sets = new Map<string, ReplaySet>();
  readonly candidates = new Map<string, Candidate>();
  readonly replays = new Map<string, Replay>();
  readonly searches = new Map<string, Search>();
  readonly schedules = new Map<string, StationSearchSchedule>();
  readonly budgets = new Map<string, LineSearchBudget>();
  readonly events: DomainEvent[] = [];

  startsPlannedReplays = false;

  private async searchRaised(events: readonly DomainEvent[]): Promise<void> {
    this.events.push(...events);

    for (const each of events) {
      if (this.startsPlannedReplays && each.kind === 'search.replays-planned') {
        await new StartSearchReplays(
          this.searchRepository,
          this.replayRepository,
          this.candidateRepository,
          this.setRepository,
          CLOCK,
          TRANSACTION,
        ).planned(each as SearchReplaysPlanned);
      }
    }
  }

  readerOver(
    pullRequests: InMemoryConfigPullRequests = new InMemoryConfigPullRequests(),
  ): ReplayedCandidatesReaderPort {
    const replays = () => [...this.replays.values()];
    const outcomesWhere = (kept: (replay: Replay) => boolean) =>
      replays()
        .filter(kept)
        .map((each) => each.outcome());
    const searchesWhere = (kept: (search: Search) => boolean) =>
      [...this.searches.values()].filter(kept);

    return {
      startedOfTeamSince: async (teamId, since, max) =>
        replays()
          .filter(
            (each) =>
              each.teamId.equals(teamId) &&
              each.startedAt.getTime() >= since.getTime(),
          )
          .sort(
            (one, other) =>
              other.startedAt.getTime() - one.startedAt.getTime() ||
              (one.id.value < other.id.value ? 1 : -1),
          )
          .slice(0, max),
      sets: async (setIds) =>
        [...this.sets.values()].filter((each) =>
          setIds.some((id) => each.id.equals(id)),
        ),
      searches: async (searchIds) =>
        searchesWhere((each) => searchIds.some((id) => each.id.equals(id))),
      searchesOfSetsStartedSince: async (setIds, since) =>
        searchesWhere(
          (each) =>
            setIds.some((id) => each.setId.equals(id)) &&
            each.startedAt.getTime() >= since.getTime(),
        ),
      outcomesOfSearches: async (searchIds) =>
        outcomesWhere((each) =>
          searchIds.some((id) => each.searchId?.equals(id) ?? false),
        ),
      servingBaselinesOfSets: async (setIds) =>
        outcomesWhere(
          (each) =>
            each.servesAsBaseline && setIds.some((id) => each.setId.equals(id)),
        ),
      healthSamplesOfSets: async (setIds) =>
        outcomesWhere(
          (each) =>
            each.healthSampleGroup !== null &&
            setIds.some((id) => each.setId.equals(id)),
        ),
      outcomes: async (replayIds) =>
        outcomesWhere((each) => replayIds.some((id) => each.id.equals(id))),
      candidates: async (candidateIds) =>
        [...this.candidates.values()]
          .filter((each) => candidateIds.some((id) => each.id.equals(id)))
          .map(candidateRowOf),
      pullRequestsOfSearches: async (searchIds) =>
        [...pullRequests.stored.values()].filter((each) =>
          searchIds.some((id) => id.value === each.searchId.value),
        ),
    };
  }

  private budgetKey(budget: { lineId: { value: string }; month: Date }) {
    return `${budget.lineId.value}:${budget.month.toISOString()}`;
  }

  readonly budgetRepository: LineSearchBudgetRepository = {
    locked: async (lineId, month) =>
      this.budgets.get(this.budgetKey({ lineId, month })) ?? null,
    ofTeam: async (teamId) =>
      [...this.budgets.values()].filter((each) => each.teamId.equals(teamId)),
    add: async (budget) => {
      if (this.budgets.has(this.budgetKey(budget))) {
        throw new LineSearchBudgetVersionConflictError(budget.lineId);
      }
      this.budgets.set(this.budgetKey(budget), budget);
    },
    save: async (budget) => {
      if (
        this.budgets.get(this.budgetKey(budget))?.version !== budget.version
      ) {
        throw new LineSearchBudgetVersionConflictError(budget.lineId);
      }
      if (budget.isDeleted) {
        this.budgets.delete(this.budgetKey(budget));
      } else {
        this.budgets.set(
          this.budgetKey(budget),
          LineSearchBudget.rehydrate({
            lineId: budget.lineId,
            month: budget.month,
            workspaceId: budget.workspaceId,
            teamId: budget.teamId,
            admissions: budget.admissions,
            version: budget.version + 1,
          }),
        );
      }
    },
  };

  readonly scheduleRepository: StationSearchScheduleRepository = {
    ofStation: async (stationId) => this.schedules.get(stationId.value) ?? null,
    locked: async (stationId) => this.schedules.get(stationId.value) ?? null,
    ofSet: async (setId) =>
      [...this.schedules.values()].find((each) => each.setId.equals(setId)) ??
      null,
    dueStations: async (now, limit) =>
      [...this.schedules.values()]
        .filter((each) => each.isDue(now))
        .slice(0, limit)
        .map((each) => each.stationId),
    withStepsPendingSince: async (before, limit) =>
      [...this.schedules.values()]
        .filter((each) => {
          const since = each.stepsPendingSince;

          return since !== null && since <= before;
        })
        .slice(0, limit)
        .map((each) => each.stationId),
    ofLine: async (lineId) =>
      [...this.schedules.values()].filter((each) =>
        each.station.lineId.equals(lineId),
      ),
    ofTeam: async (teamId) =>
      [...this.schedules.values()].filter((each) => each.teamId.equals(teamId)),
    add: async (schedule) => {
      this.events.push(...schedule.pullEvents());
      if (!this.schedules.has(schedule.stationId.value)) {
        this.schedules.set(schedule.stationId.value, schedule);
      }
    },
    save: async (schedule) => {
      if (
        this.schedules.get(schedule.stationId.value)?.version !==
        schedule.version
      ) {
        throw new StationSearchScheduleVersionConflictError(schedule.stationId);
      }

      this.events.push(...schedule.pullEvents());
      if (schedule.isDeleted) {
        this.schedules.delete(schedule.stationId.value);
      } else {
        this.schedules.set(
          schedule.stationId.value,
          StationSearchSchedule.rehydrate({
            station: schedule.station,
            setId: schedule.setId,
            lastStartedAt: schedule.lastStartedAt,
            lastSkip: schedule.lastSkip,
            searchedTasks: schedule.searchedTasks,
            alertPendingSince: schedule.alertPendingSince,
            rejected: schedule.rejected,
            rejectedAgainst: schedule.rejectedAgainst,
            lastRejectedAt: schedule.lastRejectedAt,
            lastImprovedAt: schedule.lastImprovedAt,
            requests: schedule.requests,
            pendingSteps: schedule.pendingSteps,
            checkAfter: schedule.checkAfter,
            version: schedule.version + 1,
          }),
        );
      }
    },
  };

  readonly setRepository: ReplaySetRepository = {
    find: async (id: ReplaySetId) => this.sets.get(id.value) ?? null,
    ofStation: async (stationId) =>
      [...this.sets.values()].find((each) => each.isAtStation(stationId)) ??
      null,
    atLiveStationsRefreshedBefore: async (at) =>
      [...this.sets.values()]
        .filter(
          (each) =>
            !each.isAtGoneStation &&
            (each.refreshedAt === null || each.refreshedAt < at),
        )
        .sort(
          (one, other) =>
            (one.refreshedAt?.getTime() ?? -1) -
              (other.refreshedAt?.getTime() ?? -1) ||
            one.id.value.localeCompare(other.id.value),
        ),
    add: async (set) => {
      this.events.push(...set.pullEvents());
      this.sets.set(set.id.value, set);
    },
    locked: async (id: ReplaySetId) => this.sets.get(id.value) ?? null,
    findMany: async (ids) =>
      ids.flatMap((id) => {
        const found = this.sets.get(id.value);
        return found ? [found] : [];
      }),
    ofLine: async (lineId) =>
      [...this.sets.values()].filter((each) =>
        each.station.lineId.equals(lineId),
      ),
    ofTeam: async (teamId) =>
      [...this.sets.values()].filter((each) => each.teamId.equals(teamId)),
    save: async (set) => {
      this.events.push(...set.pullEvents());
      if (set.isDeleted) {
        this.sets.delete(set.id.value);
      } else {
        this.sets.set(set.id.value, set);
      }
    },
  };

  readonly candidateRepository: CandidateRepository = {
    find: async (id: CandidateId) => this.candidates.get(id.value) ?? null,
    findMany: async (ids) =>
      ids.flatMap((id) => {
        const found = this.candidates.get(id.value);
        return found ? [found] : [];
      }),
    add: async (candidate) => {
      this.events.push(...candidate.pullEvents());
      this.candidates.set(candidate.id.value, candidate);
    },
    save: async (candidate) => {
      this.events.push(...candidate.pullEvents());
      if (candidate.isDeleted) {
        this.candidates.delete(candidate.id.value);
      }
    },
    ofTeam: async (teamId) =>
      [...this.candidates.values()].filter((each) =>
        each.teamId.equals(teamId),
      ),
  };

  readonly replayRepository: ReplayRepository = {
    find: async (id: ReplayId) => this.replays.get(id.value) ?? null,
    findMany: async (ids) =>
      ids.flatMap((id) => {
        const found = this.replays.get(id.value);
        return found ? [found] : [];
      }),
    ranAs: async (run: RunId) =>
      [...this.replays.values()].find((each) => each.ran(run)) ?? null,
    ofSet: async (setId) =>
      [...this.replays.values()].filter((each) => each.setId.equals(setId)),
    healthSamplesOfSets: async (setIds) =>
      [...this.replays.values()].filter(
        (each) =>
          each.healthSampleGroup !== null &&
          setIds.some((id) => each.setId.equals(id)),
      ),
    pairingWith: async (replayId) =>
      [...this.replays.values()]
        .filter(
          (each) =>
            (each.pairwiseReferenceId?.equals(replayId) ?? false) &&
            each.takesPairings,
        )
        .map((each) => each.id),
    ofSearch: async (searchId) =>
      [...this.replays.values()].filter(
        (each) => each.searchId?.equals(searchId) ?? false,
      ),
    teamsDispatching: async () => {
      const teams = new Map<string, TeamId>();
      for (const each of this.replays.values()) {
        if (each.hasWaiting) {
          teams.set(each.teamId.value, each.teamId);
        }
      }
      return [...teams.values()];
    },
    inProgressOfTeam: async (teamId) =>
      [...this.replays.values()].filter(
        (each) => each.teamId.equals(teamId) && each.isInProgress,
      ),
    unconfirmed: async () =>
      [...this.replays.values()].filter((each) => each.unconfirmed.length > 0),
    add: async (replay) => {
      this.events.push(...replay.pullEvents());
      this.replays.set(replay.id.value, replay);
    },
    save: async (replay) => {
      const existing = this.replays.get(replay.id.value);
      if (existing && existing.version !== replay.version) {
        throw new ReplayVersionConflictError(replay.id.value);
      }
      this.events.push(...replay.pullEvents());
      if (replay.isDeleted) {
        this.replays.delete(replay.id.value);
      } else {
        this.replays.set(replay.id.value, replay);
      }
    },
  };

  readonly searchRepository: SearchRepository = {
    find: async (id: SearchId) => this.searches.get(id.value) ?? null,
    locked: async (id: SearchId) => this.searches.get(id.value) ?? null,
    findMany: async (ids) =>
      ids.flatMap((id) => {
        const found = this.searches.get(id.value);
        return found ? [found] : [];
      }),
    ofLineStartedSince: async (lineId, since) =>
      [...this.searches.values()].filter(
        (each) =>
          each.station.lineId.equals(lineId) &&
          each.startedAt.getTime() >= since.getTime(),
      ),
    ranAs: async (run) =>
      [...this.searches.values()].find(
        (each) => each.iterationOf(run) !== null,
      ) ?? null,
    activeAtStation: async (stationId) =>
      [...this.searches.values()].find(
        (each) => each.isActive && each.station.stationId.equals(stationId),
      ) ?? null,
    activeOfLine: async (lineId) =>
      [...this.searches.values()].filter(
        (each) => each.isActive && each.station.lineId.equals(lineId),
      ),
    newestAtStation: async (stationId) =>
      [...this.searches.values()]
        .filter((each) => each.station.stationId.equals(stationId))
        .sort(
          (one, other) => other.startedAt.getTime() - one.startedAt.getTime(),
        )[0] ?? null,
    activeOfSet: async (setId) =>
      [...this.searches.values()].find(
        (each) => each.isActive && each.setId.equals(setId),
      ) ?? null,
    ofStation: async (stationId) =>
      [...this.searches.values()].filter((each) =>
        each.station.stationId.equals(stationId),
      ),
    ofTeam: async (teamId) =>
      [...this.searches.values()].filter((each) => each.teamId.equals(teamId)),
    advancing: async () =>
      [...this.searches.values()].filter(
        (each) =>
          each.isActive ||
          each.iterations.some((iteration) => iteration.agentSpent === null) ||
          each.unendedReplays.length > 0,
      ),
    add: async (search) => {
      const raised = search.pullEvents();

      this.searches.set(search.id.value, search);
      await this.searchRaised(raised);
    },
    save: async (search) => {
      const raised = search.pullEvents();

      if (search.isDeleted) {
        this.searches.delete(search.id.value);
      } else {
        this.searches.set(search.id.value, search);
      }
      await this.searchRaised(raised);
    },
  };
}

export class FakeLines implements LinesPort {
  threshold: ReplayThreshold | null = null;

  station = async (lineId: LineId, stationId: StationId) =>
    lineId.equals(STATION_VIEW.lineId) &&
    stationId.equals(STATION_VIEW.stationId)
      ? STATION_VIEW
      : null;

  findStation = async (stationId: StationId) =>
    stationId.equals(STATION_VIEW.stationId) ? STATION_VIEW : null;

  keyed = async (lineId: LineId, key: string) =>
    lineId.equals(STATION_VIEW.lineId) && key === STATION_VIEW.key
      ? STATION_VIEW
      : null;

  namedStation = async (
    lineId: LineId,
    stationId: StationId,
  ): Promise<NamedStation | null> => {
    const station = await this.station(lineId, stationId);

    return station
      ? {
          lineKey: station.lineKey,
          lineName: 'Delivery',
          key: station.key,
          name: station.name,
        }
      : null;
  };

  searchedStation = async (
    lineId: LineId,
    stationId: StationId,
  ): Promise<SearchedStation | null> => {
    const station = await this.station(lineId, stationId);

    return station
      ? {
          workspaceId: station.workspaceId,
          teamId: station.teamId,
          runsAnAgent: true,
          placement: RunnerPlacement.anywhere(),
        }
      : null;
  };

  stationSettings = async (): Promise<StationSettings | null> => ({
    block: StationBlock.of({ key: 'build', name: 'Build', kind: 'work' }),
    threshold: this.threshold,
    search: null,
    agent: null,
  });

  candidateBlock = async (
    _line: LineId,
    _station: StationId,
    block: unknown,
    _planned: PlannedLine | null,
  ): Promise<StationBlock | null> => StationBlock.of(block);
}

export class FakeStationConfigCandidates implements StationConfigCandidatesPort {
  live = async (): Promise<LiveStationConfig | null> => ({
    lineKey: 'delivery',
    fingerprint: FINGERPRINT,
    scoring: UNSCORED,
    hashes: LIVE_HASHES,
  });

  validate = async (): Promise<CandidateValidation | null> => ({
    ok: true,
    fingerprint: FINGERPRINT,
    hashes: HASHES,
    liveHashes: LIVE_HASHES,
    scoring: UNSCORED,
    changedFrom: StationChanges.none(LIVE_FINGERPRINT),
  });
}

class FakeTrialableRuns implements TrialableRunsPort {
  readonly replayables = new Map<string, RunReplayability>();

  recent: PickableRun[] = [];

  replayable = async (_workspace: unknown, runs: readonly RunId[]) =>
    runs.flatMap((run) => {
      const found = this.replayables.get(run.value);
      return found ? [found] : [];
    });

  runSummaries = async (workspace: unknown, runs: readonly RunId[]) =>
    (await this.replayable(workspace, runs)).map((each) => ({
      ...each,
      title: null as string | null,
      endedAt: null,
    }));

  recentAt = async () => this.recent;
}

class FakeStartingPointHolds implements StartingPointHoldsPort {
  readonly held = new Map<string, readonly string[]>();

  hold = async (
    holder: string,
    _workspace: unknown,
    runs: readonly RunId[],
  ) => {
    this.held.set(
      holder,
      runs.map((each) => each.value),
    );
  };

  release = async (holder: string) => {
    this.held.delete(holder);
  };
}

class FakeRunDispatch implements ReplayRunDispatching, SearchRunDispatching {
  readonly dispatched: ReplayRunOrder[] = [];
  readonly cancelledQueued: string[] = [];
  unqueued: ReplayRunQueued | null = null;

  cancelled: { run: string; leaveRunAsIs: boolean }[] = [];

  queuedRuns = new Set<string>();

  cancel = async (
    run: RunId,
    _owner: ReplayRunOwner,
    leaveRunAsIs: boolean,
  ): Promise<CancelledRun> => {
    this.cancelled.push({ run: run.value, leaveRunAsIs });
    return this.queuedRuns.has(run.value)
      ? { wasQueued: true, fingerprint: FINGERPRINT }
      : { wasQueued: false };
  };

  unanswerable = new Set<string>();

  answerable = async (
    inputs: readonly OracleAnswerInput[],
  ): Promise<readonly RunId[]> =>
    inputs
      .filter((each) => !this.unanswerable.has(each.run.value))
      .map((each) => each.run);

  dispatch = async (order: ReplayRunOrder): Promise<ReplayRunQueued> => {
    this.dispatched.push(order);
    return this.unqueued ?? { queued: true, fingerprint: FINGERPRINT };
  };

  cancelQueued = async (runs: readonly RunId[]) => {
    this.cancelledQueued.push(...runs.map((each) => each.value));
  };

  invalidAgent: AgentProblem | null = null;

  agentProblem = () => this.invalidAgent;

  readonly searchesDispatched: SearchRunOrder[] = [];

  searchRefused = false;

  dispatchSearch = async (order: SearchRunOrder): Promise<SearchRunQueued> => {
    this.searchesDispatched.push(order);
    return { queued: !this.searchRefused };
  };

  readonly cancelledSearchRuns: string[] = [];

  cancelSearchRun = async (run: RunId) => {
    this.cancelledSearchRuns.push(run.value);
  };

  readonly leasedSearchRuns = new Map<string, LeasedSearchRun>();

  leasedSearchRun = async (run: RunId) =>
    this.leasedSearchRuns.get(run.value) ?? null;

  unclaimed: UnclaimedCancellation = { outcome: 'cancelled', started: false };

  readonly cancelledUnclaimed: string[] = [];

  cancelUnclaimedSearchRun = async (
    run: RunId,
  ): Promise<UnclaimedCancellation> => {
    if (this.unclaimed.outcome === 'cancelled') {
      this.cancelledUnclaimed.push(run.value);
    }
    return this.unclaimed;
  };

  readonly runStatuses = new Map<string, SearchRunStatus>();

  searchRunStatuses = async (runs: readonly RunId[]) =>
    runs.flatMap((run) => {
      const status = this.runStatuses.get(run.value);
      return status ? [status] : [];
    });
}

export const liveFrom = (configs: StationConfigs) => {
  const live = configs.live.bind(configs);

  return async (): Promise<LiveConfig> => {
    const read = await live(STATION.lineId, STATION.stationId);

    if (!read) {
      throw new Error('The fake station has no live config');
    }

    return read;
  };
};

export class FakeSuppliers {
  readonly lines = new FakeLines();
  readonly candidates = new FakeStationConfigCandidates();
  readonly configs = new StationConfigs(this.candidates, this.lines);
  readonly trialableRuns = new FakeTrialableRuns();
  readonly holds = new FakeStartingPointHolds();
  readonly dispatch = new FakeRunDispatch();
}

export const peopleWho = (mayPlan: boolean | null): PeoplePort => ({
  membershipOn: async () =>
    mayPlan === null ? null : { workspaceId: STATION.workspaceId, mayPlan },
  teamKey: async () => 'core',
});

export const accessFor = (
  memory: InMemoryReplays,
  suppliers: FakeSuppliers,
  mayPlan: boolean | null = true,
): ReplaysAccess =>
  new ReplaysAccess(
    peopleWho(mayPlan),
    suppliers.lines,
    memory.setRepository,
    memory.replayRepository,
    memory.searchRepository,
  );

export class FakeChangeReview implements ChangeReviewPort {
  readonly stacks = new Map<string, StackStatus[]>();
  readonly rechecks = new Map<string, StackStatus[]>();
  readonly recheckRequests: string[] = [];
  recheckableStacks: readonly string[] = ['stack_1'];

  async stacksOf(run: RunId): Promise<readonly StackStatus[]> {
    return this.stacks.get(run.value) ?? [];
  }

  async rechecksOf(run: RunId): Promise<readonly StackStatus[]> {
    return this.rechecks.get(run.value) ?? [];
  }

  async recheckable(): Promise<readonly ChangeStackId[]> {
    return this.recheckableStacks.map((each) => ChangeStackId.of(each));
  }

  async recheck(run: RunId, stackId: ChangeStackId): Promise<void> {
    this.recheckRequests.push(`${run.value}#${stackId.value}`);
  }
}

export class FakeInsights implements InsightsPort {
  readonly accepted = new Set<string>();
  readonly sentBack = new Set<string>();

  async acceptedAfter(run: RunId): Promise<boolean> {
    return this.accepted.has(run.value);
  }

  async originalOutcomes(): Promise<ReadonlyMap<string, OriginalOutcome>> {
    return new Map([
      ...[...this.accepted].map((run) => [run, 'accepted'] as const),
      ...[...this.sentBack].map((run) => [run, 'sent-back'] as const),
    ]);
  }
}

export const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export const CLOCK: ClockPort = { now: () => NOW, sleep: async () => {} };

let id = 0;

export const IDS = {
  generate: () => {
    id += 1;
    return `id_${id}`;
  },
};

export const TRANSACTION = {
  inTransaction: <T>(work: () => Promise<T>) => work(),
};

export const usageFor = (
  memory: InMemoryReplays,
  checks: ReplayCheckRepository = new InMemoryChecks(memory.events),
) =>
  new SetUsage(
    { ...memory.searchRepository },
    { ...memory.replayRepository },
    checks,
  );

export const refreshingFor = (
  memory: InMemoryReplays,
  suppliers: FakeSuppliers,
  insights: InsightsPort = new FakeInsights(),
) =>
  new RefreshReplaySets(
    memory.setRepository,
    memory.searchRepository,
    usageFor(memory),
    suppliers.trialableRuns,
    insights,
    CLOCK,
    TRANSACTION,
    QUIET,
  );

export const snapshotsFor = (
  memory: InMemoryReplays,
  suppliers: FakeSuppliers,
  mayPlan: boolean | null = true,
) =>
  new LiveCandidates(
    peopleWho(mayPlan),
    suppliers.configs,
    memory.candidateRepository,
    IDS,
    CLOCK,
    TRANSACTION,
    QUIET,
  );

export const stepsFor = (
  memory: InMemoryReplays,
  suppliers: FakeSuppliers,
  clock: ClockPort = CLOCK,
) =>
  new PendingSearchSteps(
    memory.scheduleRepository,
    memory.searchRepository,
    memory.budgetRepository,
    snapshotsFor(memory, suppliers),
    clock,
    TRANSACTION,
    QUIET,
  );

export class InMemoryConfigPullRequests implements ConfigPullRequestRepository {
  readonly stored = new Map<string, ConfigPullRequest>();
  readonly events: DomainEvent[] = [];

  async find(id: { value: string }) {
    return this.stored.get(id.value) ?? null;
  }

  async forCandidate(
    searchId: { value: string },
    candidateId: { value: string },
  ) {
    return (
      [...this.stored.values()].find(
        (each) =>
          each.searchId.value === searchId.value &&
          each.candidateId.value === candidateId.value,
      ) ?? null
    );
  }

  async ofSearch(searchId: { value: string }) {
    return [...this.stored.values()].filter(
      (each) => each.searchId.value === searchId.value,
    );
  }

  async findMany(ids: readonly { value: string }[]) {
    return ids.flatMap((id) => {
      const found = this.stored.get(id.value);
      return found ? [found] : [];
    });
  }

  async ofTeam(teamId: { value: string }) {
    return [...this.stored.values()].filter(
      (each) => each.teamId.value === teamId.value,
    );
  }

  async openAtStation(stationId: StationId) {
    return [...this.stored.values()].some(
      (each) => each.station.stationId.equals(stationId) && each.isOpen,
    );
  }

  async fromHost(
    workspaceId: { value: string },
    key: { hostId: number | null; repository: string; number: number },
  ) {
    return (
      [...this.stored.values()].find(
        (each) =>
          each.workspaceId.value === workspaceId.value &&
          (key.hostId === null
            ? each.repository?.value.toLowerCase() ===
                key.repository.toLowerCase() && each.number === key.number
            : each.hostId === key.hostId),
      ) ?? null
    );
  }

  async dueForCheck(checkedBefore: Date, limit: number) {
    return [...this.stored.values()]
      .filter(
        (each) =>
          each.current === 'opened' &&
          each.checkedAt !== null &&
          each.checkedAt < checkedBefore,
      )
      .slice(0, limit);
  }

  async openedOnLine(lineId: LineId) {
    return [...this.stored.values()].filter(
      (each) => each.station.lineId.equals(lineId) && each.current === 'opened',
    );
  }

  async due(state: 'opening' | 'closing', now: Date) {
    return [...this.stored.values()].filter(
      (each) => each.current === state && each.isDue(now),
    );
  }

  async add(added: ConfigPullRequest) {
    if (
      (await this.forCandidate(added.searchId, added.candidateId)) ||
      (added.isOpen && (await this.openAtStation(added.station.stationId)))
    ) {
      throw new ConfigPullRequestVersionConflictError(added.id.value);
    }

    this.events.push(...added.pullEvents());
    this.stored.set(added.id.value, added);
  }

  async save(saved: ConfigPullRequest) {
    const existing = this.stored.get(saved.id.value);

    if (!existing || existing.version !== saved.version) {
      throw new ConfigPullRequestVersionConflictError(saved.id.value);
    }

    this.events.push(...saved.pullEvents());

    if (saved.isDeleted) {
      this.stored.delete(saved.id.value);
      return;
    }

    this.stored.set(
      saved.id.value,
      ConfigPullRequest.rehydrate({
        id: saved.id,
        searchId: saved.searchId,
        candidateId: saved.candidateId,
        station: saved.station,
        stationKey: saved.stationKey,
        candidateName: saved.candidateName,
        repository: saved.repository,
        path: saved.path,
        branch: saved.branch,
        state: saved.current,
        url: saved.url,
        number: saved.number,
        hostId: saved.hostId,
        basedOn: saved.basedOn,
        proposing: saved.proposing,
        checkedAt: saved.checkedAt,
        closedBecause: saved.closedBecause,
        closeFailure: saved.closeFailure,
        reason: saved.reason,
        retries: saved.retries,
        lastCommit: saved.lastCommit,
        dueAt: saved.dueAt,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        version: saved.version + 1,
      }),
    );
  }
}

export class InMemoryChecks implements ReplayCheckRepository {
  readonly stored = new Map<string, ReplayCheck>();

  constructor(private readonly events: DomainEvent[]) {}

  find = async (id: { value: string }) => this.stored.get(id.value) ?? null;

  ofChange = async (stationId: StationId, change: CheckedChange) =>
    [...this.stored.values()].filter(
      (each) =>
        each.station.stationId.equals(stationId) && each.change.equals(change),
    );

  ofPullRequest = async (stationId: StationId, pullRequest: number) =>
    [...this.stored.values()].filter(
      (each) =>
        each.station.stationId.equals(stationId) &&
        each.reference.pullRequest === pullRequest,
    );

  awaitingBaseline = async () =>
    [...this.stored.values()].filter((each) => each.awaitsBaseline);

  awaitingBaselineOfSet = async (setId: ReplaySetId) =>
    [...this.stored.values()].filter(
      (each) => each.awaitsBaseline && each.setId.equals(setId),
    );

  ofTeam = async () => [...this.stored.values()];

  ofSet = async () => [...this.stored.values()];

  pageOfSet = async (
    _setId: unknown,
    page: { before: { value: string } | null; limit: number },
  ) => {
    const newest = [...this.stored.values()].reverse();
    const from = page.before
      ? newest.findIndex((each) => each.id.value === page.before?.value) + 1
      : 0;

    return page.before && from === 0
      ? []
      : newest.slice(from, from + page.limit);
  };

  add = async (check: ReplayCheck) => {
    this.events.push(...check.pullEvents());
    this.stored.set(check.id.value, check);
  };

  save = async (check: ReplayCheck) => {
    if (this.stored.get(check.id.value)?.version !== check.version) {
      throw new ReplayCheckVersionConflictError(check.id.value);
    }

    this.events.push(...check.pullEvents());

    if (check.isDeleted) {
      this.stored.delete(check.id.value);
    } else {
      this.stored.set(
        check.id.value,
        ReplayCheck.rehydrate({
          id: check.id,
          station: check.station,
          stationKey: check.stationKey,
          setId: check.setId,
          setEntries: check.setEntries,
          attempt: check.attempt,
          candidateId: check.candidateId,
          replayId: check.replayId,
          reference: check.reference,
          liveFingerprint: check.liveFingerprint,
          candidateFingerprint: check.candidateFingerprint,
          liveHashes: check.liveHashes,
          candidateHashes: check.candidateHashes,
          threshold: check.threshold,
          repeats: check.repeats,
          scoringPinnedToLive: check.scoringPinnedToLive,
          baseline: check.baseline,
          createdAt: check.createdAt,
          version: check.version + 1,
        }),
      );
    }
  };
}

export class InMemoryReplayRunDecisions implements ReplayRunDecisionRepository {
  readonly decisions = new Map<string, ReplayRunDecision>();
  readonly decidedAt = new Map<string, Date>();
  readonly deletedReplays = new Set<string>();
  now = new Date('2026-11-07T12:00:00.000Z');

  find = async (runId: RunId) => this.decisions.get(runId.value) ?? null;

  ofTeam = async (teamId: TeamId) =>
    [...this.decisions.values()].filter((each) =>
      each.owner.teamId.equals(teamId),
    );

  ofReplay = async (replayId: ReplayId) =>
    [...this.decisions.values()].filter((each) =>
      each.owner.replayId.equals(replayId),
    );

  ofDeletedReplays = async (decidedBefore: Date, limit: number) =>
    [...this.decisions.values()]
      .filter(
        (each) =>
          this.deletedReplays.has(each.owner.replayId.value) &&
          (this.decidedAt.get(each.runId.value) ?? this.now) < decidedBefore,
      )
      .slice(0, limit);

  add = async (decision: ReplayRunDecision) => {
    if (this.decisions.has(decision.runId.value)) {
      throw new ReplayRunDecisionVersionConflictError(decision.runId);
    }
    this.decisions.set(decision.runId.value, decision);
    this.decidedAt.set(decision.runId.value, this.now);
  };

  save = async (decision: ReplayRunDecision) => {
    if (
      this.decisions.get(decision.runId.value)?.version !== decision.version
    ) {
      throw new ReplayRunDecisionVersionConflictError(decision.runId);
    }
    if (decision.isDeleted) {
      this.decisions.delete(decision.runId.value);
      this.decidedAt.delete(decision.runId.value);
      return;
    }
    this.decisions.set(
      decision.runId.value,
      ReplayRunDecision.rehydrate({
        runId: decision.runId,
        owner: decision.owner,
        decided: decision.decided,
        unreplayableReason: decision.unreplayableReason,
        trial: decision.trial,
        version: decision.version + 1,
      }),
    );
  };
}
