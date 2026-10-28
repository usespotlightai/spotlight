import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type {
  InsightsPort,
  JudgingAgainOrdered,
  JudgingOrder,
  JudgingOrdered,
  SideBySideJudgingOrder,
} from '@replays/application/ports/insights.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type {
  AgentProblem,
  CancelledRun,
  LeasedSearchRun,
  OracleAnswerInput,
  PickableRun,
  ReplayRunOrder,
  ReplayRunQueued,
  RunReplayability,
  SearchRunOrder,
  SearchRunQueued,
  SearchRunStatus,
  StationView,
  UnclaimedCancellation,
  ValidatedCandidate,
  WorkPort,
} from '@replays/application/ports/work.port';
import { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import { RefreshKeptSets } from '@replays/application/services/refresh-kept-sets.service';
import { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { SetStations } from '@replays/application/services/set-stations.service';
import { SetUsage } from '@replays/application/services/set-usage.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ConfigPullRequestVersionConflictError } from '@replays/domain/exceptions/config-pull-request-version-conflict.error';
import { ReplayVersionConflictError } from '@replays/domain/exceptions/replay-version-conflict.error';
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
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { baselineOf } from '@replays/domain/services/baseline';
import type { OriginalOutcome } from '@replays/domain/services/composition';
import { isDueForRefresh } from '@replays/domain/services/kept-set-refresh';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { StackStatus } from '@replays/domain/value-objects/change-checks.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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

export class InMemoryReplays {
  readonly sets = new Map<string, ReplaySet>();
  readonly candidates = new Map<string, Candidate>();
  readonly replays = new Map<string, Replay>();
  readonly searches = new Map<string, Search>();
  readonly events: DomainEvent[] = [];

  readonly setRepository: ReplaySetRepository = {
    find: async (id: ReplaySetId) => this.sets.get(id.value) ?? null,
    ofStation: async (stationId) =>
      [...this.sets.values()].find((each) => each.isAtStation(stationId)) ??
      null,
    dueForRefresh: async (cutoff, limit) =>
      [...this.sets.values()]
        .filter((each) => isDueForRefresh(each, cutoff))
        .sort(
          (one, other) =>
            (one.refreshedAt?.getTime() ?? -1) -
              (other.refreshedAt?.getTime() ?? -1) ||
            one.id.value.localeCompare(other.id.value),
        )
        .slice(0, limit),
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
      [...this.sets.values()].filter((each) => each.station.lineId === lineId),
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
    locked: async (id: CandidateId) => this.candidates.get(id.value) ?? null,
    lockedForUse: async (id: CandidateId) =>
      this.candidates.get(id.value) ?? null,
    proposedAt: async (teamId, address) =>
      [...this.candidates.values()].find(
        (each) =>
          each.teamId.equals(teamId) &&
          each.isProposed &&
          each.address.equals(address),
      ) ?? null,
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
    ofTeams: async (teamIds) =>
      [...this.candidates.values()].filter((each) =>
        teamIds.some((teamId) => each.teamId.equals(teamId)),
      ),
  };

  readonly replayRepository: ReplayRepository = {
    find: async (id: ReplayId) => this.replays.get(id.value) ?? null,
    ranAs: async (run: RunId) =>
      [...this.replays.values()].find((each) => each.ran(run)) ?? null,
    ofSet: async (setId) =>
      [...this.replays.values()].filter((each) => each.setId.equals(setId)),
    ofCandidate: async (candidateId) =>
      [...this.replays.values()].filter((each) =>
        each.candidateId.equals(candidateId),
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
    ofSearches: async (searchIds) =>
      [...this.replays.values()].filter((each) =>
        searchIds.some((id) => each.searchId?.equals(id) ?? false),
      ),
    baselinesOfSets: async (setIds) =>
      setIds.flatMap((id) => {
        const found = baselineOf(
          [...this.replays.values()].filter((each) => each.setId.equals(id)),
        );
        return found ? [found] : [];
      }),
    healthReadOfSets: async (setIds) =>
      [...this.replays.values()].filter((each) =>
        setIds.some((id) => each.setId.equals(id)),
      ),
    ofTeamStartedSince: async (teamId, since, max) =>
      [...this.replays.values()]
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
    teamsDispatching: async () => {
      const teams = new Map<string, TeamId>();
      for (const each of this.replays.values()) {
        if (each.hasWaiting) {
          teams.set(each.teamId.value, each.teamId);
        }
      }
      return [...teams.values()];
    },
    inProgressOfTeamLocked: async (teamId) =>
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
    ofSetsStartedSince: async (setIds, since) =>
      [...this.searches.values()].filter(
        (each) =>
          setIds.some((id) => each.setId.equals(id)) &&
          each.startedAt.getTime() >= since.getTime(),
      ),
    ranAs: async (run) =>
      [...this.searches.values()].find(
        (each) => each.iterationOf(run) !== null,
      ) ?? null,
    activeAtStation: async (stationId) =>
      [...this.searches.values()].find(
        (each) => each.isActive && each.station.stationId === stationId,
      ) ?? null,
    activeOfSet: async (setId) =>
      [...this.searches.values()].find(
        (each) => each.isActive && each.setId.equals(setId),
      ) ?? null,
    ofStation: async (stationId) =>
      [...this.searches.values()].filter(
        (each) => each.station.stationId === stationId,
      ),
    ofTeam: async (teamId) =>
      [...this.searches.values()].filter((each) => each.teamId.equals(teamId)),
    advancing: async () =>
      [...this.searches.values()].filter(
        (each) =>
          each.isActive ||
          each.iterations.some((iteration) => iteration.agentSpent === null) ||
          [...this.replays.values()].some(
            (replay) =>
              (replay.searchId?.equals(each.id) ?? false) &&
              replay.isDispatching,
          ),
      ),
    pageOfTeam: async (teamId, page) => {
      const ofTeam = [...this.searches.values()]
        .filter((each) => each.teamId.equals(teamId))
        .sort(
          (one, other) =>
            other.startedAt.getTime() - one.startedAt.getTime() ||
            (one.id.value < other.id.value ? 1 : -1),
        );
      const after = page.before
        ? ofTeam.findIndex((each) => each.id.equals(page.before as SearchId))
        : -1;

      if (page.before && after < 0) {
        return [];
      }

      return ofTeam.slice(after + 1, after + 1 + page.limit);
    },
    add: async (search) => {
      this.events.push(...search.pullEvents());
      this.searches.set(search.id.value, search);
    },
    save: async (search) => {
      this.events.push(...search.pullEvents());
      if (search.isDeleted) {
        this.searches.delete(search.id.value);
      } else {
        this.searches.set(search.id.value, search);
      }
    },
  };
}

export class FakeWork implements WorkPort {
  readonly replayables = new Map<string, RunReplayability>();
  readonly dispatched: ReplayRunOrder[] = [];
  readonly cancelledQueued: string[] = [];
  readonly startingPointHolds = new Map<string, readonly string[]>();
  unqueued: ReplayRunQueued | null = null;

  station = async (lineId: string, stationId: string) =>
    lineId === STATION_VIEW.lineId && stationId === STATION_VIEW.stationId
      ? STATION_VIEW
      : null;

  findStation = async (stationId: string) =>
    stationId === STATION_VIEW.stationId ? STATION_VIEW : null;

  keyed = async (lineId: string, key: string) =>
    lineId === STATION_VIEW.lineId && key === STATION_VIEW.key
      ? STATION_VIEW
      : null;

  replayable = async (_workspace: unknown, runs: readonly RunId[]) =>
    runs.flatMap((run) => {
      const found = this.replayables.get(run.value);
      return found ? [found] : [];
    });

  runSummaries = async (workspace: unknown, runs: readonly RunId[]) =>
    (await this.replayable(workspace, runs)).map((each) => ({
      ...each,
      title: null as string | null,
      state: null,
      endedAt: null,
      origin: null,
    }));

  recent: PickableRun[] = [];

  recentAt = async () => this.recent;

  cancelled: { run: string; leaveRunAsIs: boolean }[] = [];

  queuedRuns = new Set<string>();

  cancel = async (run: RunId, leaveRunAsIs: boolean): Promise<CancelledRun> => {
    this.cancelled.push({ run: run.value, leaveRunAsIs });
    return this.queuedRuns.has(run.value)
      ? { queued: true, fingerprint: FINGERPRINT }
      : { queued: false };
  };

  validate = async (
    _line: string,
    _station: string,
    block: unknown,
    _planned?: PlannedLine | null,
  ): Promise<ValidatedCandidate> => ({
    ok: true,
    fingerprint: FINGERPRINT,
    hashes: HASHES,
    liveHashes: LIVE_HASHES,
    scoring: UNSCORED,
    changedFrom: StationChanges.none(LIVE_FINGERPRINT),
    block: StationBlock.of(block),
  });

  threshold: ReplayThreshold | null = null;

  live = async () => ({
    lineKey: 'delivery',
    block: StationBlock.of({ key: 'build', name: 'Build', kind: 'work' }),
    fingerprint: FINGERPRINT,
    scoring: UNSCORED,
    hashes: LIVE_HASHES,
    threshold: this.threshold,
  });

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

  readonly durationsOf = new Map<string, number>();

  durations = async (runs: readonly RunId[]) =>
    new Map(
      runs.flatMap((run) => {
        const ms = this.durationsOf.get(run.value);
        return ms === undefined ? [] : [[run.value, ms] as const];
      }),
    );

  invalidAgent: AgentProblem | null = null;

  agentProblem = () => this.invalidAgent;

  readonly searchesDispatched: SearchRunOrder[] = [];

  searchProblem: string | null = null;

  dispatchSearch = async (order: SearchRunOrder): Promise<SearchRunQueued> => {
    this.searchesDispatched.push(order);
    return this.searchProblem === null
      ? { queued: true }
      : { queued: false, reason: this.searchProblem };
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

  hold = async (
    holder: string,
    _workspace: unknown,
    runs: readonly RunId[],
  ) => {
    this.startingPointHolds.set(
      holder,
      runs.map((each) => each.value),
    );
  };

  release = async (holder: string) => {
    this.startingPointHolds.delete(holder);
  };
}

export const peopleWho = (mayPlan: boolean | null): PeoplePort => ({
  membershipOn: async () =>
    mayPlan === null ? null : { workspaceId: STATION.workspaceId, mayPlan },
  teamKey: async () => 'core',
  workspaceSlug: async () => 'acme',
  readableTeams: async () =>
    mayPlan === null
      ? null
      : [
          {
            teamId: STATION.teamId,
            workspaceId: STATION.workspaceId,
            key: 'core',
          },
        ],
});

export const accessFor = (
  memory: InMemoryReplays,
  work: FakeWork,
  mayPlan: boolean | null = true,
): ReplaysAccess =>
  new ReplaysAccess(
    peopleWho(mayPlan),
    work,
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

  async recheckable(): Promise<readonly string[]> {
    return this.recheckableStacks;
  }

  async recheck(run: RunId, stackId: string): Promise<void> {
    this.recheckRequests.push(`${run.value}#${stackId}`);
  }
}

export class FakeInsights implements InsightsPort {
  readonly accepted = new Set<string>();
  readonly sentBack = new Set<string>();
  readonly judgingRequests: JudgingOrder[] = [];
  readonly rejudgingRequests: string[] = [];
  readonly sideBySideJudgingRequests: SideBySideJudgingOrder[] = [];
  answer: JudgingOrdered = 'requested';
  pairAnswer: JudgingOrdered = 'requested';
  againAnswer: JudgingAgainOrdered = 'requested';

  async judgeAgain(run: RunId): Promise<JudgingAgainOrdered> {
    this.rejudgingRequests.push(run.value);
    return this.againAnswer;
  }

  async acceptedAfter(run: RunId): Promise<boolean> {
    return this.accepted.has(run.value);
  }

  async originalOutcomes(): Promise<ReadonlyMap<string, OriginalOutcome>> {
    return new Map([
      ...[...this.accepted].map((run) => [run, 'accepted'] as const),
      ...[...this.sentBack].map((run) => [run, 'sent-back'] as const),
    ]);
  }

  async judge(order: JudgingOrder): Promise<JudgingOrdered> {
    this.judgingRequests.push(order);
    return this.answer;
  }

  async judgeSideBySide(
    order: SideBySideJudgingOrder,
  ): Promise<JudgingOrdered> {
    this.sideBySideJudgingRequests.push(order);
    return this.pairAnswer;
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
  work: FakeWork,
  insights: InsightsPort = new FakeInsights(),
) =>
  new RefreshKeptSets(
    memory.setRepository,
    usageFor(memory),
    work,
    insights,
    CLOCK,
    TRANSACTION,
    QUIET,
  );

export const stationsFor = (memory: InMemoryReplays, work: FakeWork) =>
  new SetStations(memory.setRepository, work, TRANSACTION, CLOCK);

export const snapshotsFor = (
  memory: InMemoryReplays,
  work: FakeWork,
  mayPlan: boolean | null = true,
) =>
  new LiveSnapshots(
    peopleWho(mayPlan),
    work,
    memory.candidateRepository,
    IDS,
    CLOCK,
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

  async ofSearches(searchIds: readonly { value: string }[]) {
    return [...this.stored.values()].filter((each) =>
      searchIds.some((id) => id.value === each.searchId.value),
    );
  }

  async ofTeam(teamId: { value: string }) {
    return [...this.stored.values()].filter(
      (each) => each.teamId.value === teamId.value,
    );
  }

  async due(now: Date) {
    return [...this.stored.values()].filter((each) => each.isDue(now));
  }

  async add(added: ConfigPullRequest) {
    const existing = await this.forCandidate(added.searchId, added.candidateId);

    if (existing) {
      return existing;
    }

    this.events.push(...added.pullEvents());
    this.stored.set(added.id.value, added);

    return added;
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
        reason: saved.reason,
        generation: saved.generation,
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

  matching = async (
    stationId: string,
    candidate: StationHashes,
    live: StationHashes,
  ) =>
    [...this.stored.values()].filter(
      (each) =>
        each.station.stationId === stationId &&
        each.candidateHashes.behaviour === candidate.behaviour &&
        each.liveHashes.scoring === live.scoring,
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
    if (check.isDeleted) {
      this.stored.delete(check.id.value);
    } else {
      this.stored.set(check.id.value, check);
    }
  };
}
