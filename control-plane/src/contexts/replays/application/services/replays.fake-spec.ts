import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type {
  JudgingOrder,
  JudgingOrdered,
  OutcomesPort,
} from '@replays/application/ports/outcomes.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type {
  AgentRefusal,
  ExaminedCandidate,
  HeldSearchRun,
  ReplayRunOrder,
  ReplayRunQueued,
  RunForgone,
  RunReplayability,
  SearchRunOrder,
  SearchRunQueued,
  SearchRunStanding,
  StationAtHand,
  UnclaimedWithdrawal,
  WorkPort,
} from '@replays/application/ports/work.port';
import { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { SetStations } from '@replays/application/services/set-stations.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ConfigPullRequestMovedOnError } from '@replays/domain/exceptions/config-pull-request-moved-on.error';
import { ReplayMovedOnError } from '@replays/domain/exceptions/replay-moved-on.error';
import {
  DIGESTS,
  FINGERPRINT,
  LIVE_DIGESTS,
  LIVE_FINGERPRINT,
  NOW,
  STATION,
  UNSCORED,
} from '@replays/domain/replays.fake-spec';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { StackStanding } from '@replays/domain/value-objects/change-checks.vo';
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
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
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

export const AT_HAND: StationAtHand = {
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
    atStation: async (stationId) =>
      [...this.sets.values()].filter((each) => each.isAtStation(stationId)),
    add: async (set) => {
      this.events.push(...set.pullEvents());
      this.sets.set(set.id.value, set);
    },
    locked: async (id: ReplaySetId) => this.sets.get(id.value) ?? null,
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
      if (candidate.isAbandoned) {
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
    ofSearch: async (searchId) =>
      [...this.replays.values()].filter(
        (each) => each.searchId?.equals(searchId) ?? false,
      ),
    ofSearches: async (searchIds) =>
      [...this.replays.values()].filter((each) =>
        searchIds.some((id) => each.searchId?.equals(id) ?? false),
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
    underwayOfTeamLocked: async (teamId) =>
      [...this.replays.values()].filter(
        (each) => each.teamId.equals(teamId) && each.isUnderway,
      ),
    unconfirmed: async () =>
      [...this.replays.values()].filter((each) => each.unconfirmed.length > 0),
    add: async (replay) => {
      this.events.push(...replay.pullEvents());
      this.replays.set(replay.id.value, replay);
    },
    save: async (replay) => {
      const held = this.replays.get(replay.id.value);
      if (held && held.version !== replay.version) {
        throw new ReplayMovedOnError(replay.id.value);
      }
      this.events.push(...replay.pullEvents());
      if (replay.isAbandoned) {
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
      if (search.isAbandoned) {
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
  readonly withdrawn: string[] = [];
  readonly held = new Map<string, readonly string[]>();
  refusing: ReplayRunQueued | null = null;

  station = async (lineId: string, stationId: string) =>
    lineId === AT_HAND.lineId && stationId === AT_HAND.stationId
      ? AT_HAND
      : null;

  keyed = async (lineId: string, key: string) =>
    lineId === AT_HAND.lineId && key === AT_HAND.key ? AT_HAND : null;

  replayable = async (_workspace: unknown, runs: readonly RunId[]) =>
    runs.flatMap((run) => {
      const found = this.replayables.get(run.value);
      return found ? [found] : [];
    });

  standing = async (workspace: unknown, runs: readonly RunId[]) =>
    (await this.replayable(workspace, runs)).map((each) => ({
      ...each,
      title: null,
      state: null,
      endedAt: null,
    }));

  recentAt = async () => [];

  forgone: { run: string; keep: boolean }[] = [];

  queuedRuns = new Set<string>();

  forgo = async (run: RunId, keep: boolean): Promise<RunForgone> => {
    this.forgone.push({ run: run.value, keep });
    return this.queuedRuns.has(run.value)
      ? { queued: true, fingerprint: FINGERPRINT }
      : { queued: false };
  };

  examine = async (
    _line: string,
    _station: string,
    block: unknown,
    _planned?: PlannedLine | null,
  ): Promise<ExaminedCandidate> => ({
    ok: true,
    fingerprint: FINGERPRINT,
    digests: DIGESTS,
    liveDigests: LIVE_DIGESTS,
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
    digests: LIVE_DIGESTS,
    threshold: this.threshold,
  });

  dispatch = async (order: ReplayRunOrder): Promise<ReplayRunQueued> => {
    this.dispatched.push(order);
    return this.refusing ?? { queued: true, fingerprint: FINGERPRINT };
  };

  withdraw = async (runs: readonly RunId[]) => {
    this.withdrawn.push(...runs.map((each) => each.value));
  };

  readonly durationsOf = new Map<string, number>();

  durations = async (runs: readonly RunId[]) =>
    new Map(
      runs.flatMap((run) => {
        const ms = this.durationsOf.get(run.value);
        return ms === undefined ? [] : [[run.value, ms] as const];
      }),
    );

  refusingAgent: AgentRefusal | null = null;

  agentRefusal = () => this.refusingAgent;

  readonly searchesDispatched: SearchRunOrder[] = [];

  refusingSearch: string | null = null;

  dispatchSearch = async (order: SearchRunOrder): Promise<SearchRunQueued> => {
    this.searchesDispatched.push(order);
    return this.refusingSearch === null
      ? { queued: true }
      : { queued: false, reason: this.refusingSearch };
  };

  readonly searchesWithdrawn: string[] = [];

  withdrawSearch = async (run: RunId) => {
    this.searchesWithdrawn.push(run.value);
  };

  readonly heldSearchRuns = new Map<string, HeldSearchRun>();

  heldSearchRun = async (run: RunId) =>
    this.heldSearchRuns.get(run.value) ?? null;

  unclaimed: UnclaimedWithdrawal = { outcome: 'withdrawn', started: false };

  readonly unclaimedWithdrawn: string[] = [];

  withdrawUnclaimedSearch = async (
    run: RunId,
  ): Promise<UnclaimedWithdrawal> => {
    if (this.unclaimed.outcome === 'withdrawn') {
      this.unclaimedWithdrawn.push(run.value);
    }
    return this.unclaimed;
  };

  readonly runStandings = new Map<string, SearchRunStanding>();

  searchRunStandings = async (runs: readonly RunId[]) =>
    runs.flatMap((run) => {
      const standing = this.runStandings.get(run.value);
      return standing ? [standing] : [];
    });

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

export const peopleWho = (mayPlan: boolean | null): PeoplePort => ({
  standingOn: async () =>
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
  readonly stacks = new Map<string, StackStanding[]>();

  async stacksOf(run: RunId): Promise<readonly StackStanding[]> {
    return this.stacks.get(run.value) ?? [];
  }
}

export class FakeOutcomes implements OutcomesPort {
  readonly accepted = new Set<string>();
  readonly asked: JudgingOrder[] = [];
  answer: JudgingOrdered = 'asked';

  async acceptedAfter(run: RunId): Promise<boolean> {
    return this.accepted.has(run.value);
  }

  async judge(order: JudgingOrder): Promise<JudgingOrdered> {
    this.asked.push(order);
    return this.answer;
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
  run: <T>(work: () => Promise<T>) => work(),
};

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
  readonly kept = new Map<string, ConfigPullRequest>();

  async find(id: { value: string }) {
    return this.kept.get(id.value) ?? null;
  }

  async forCandidate(
    searchId: { value: string },
    candidateId: { value: string },
  ) {
    return (
      [...this.kept.values()].find(
        (each) =>
          each.searchId.value === searchId.value &&
          each.candidateId.value === candidateId.value,
      ) ?? null
    );
  }

  async ofSearch(searchId: { value: string }) {
    return [...this.kept.values()].filter(
      (each) => each.searchId.value === searchId.value,
    );
  }

  async ofTeam(teamId: { value: string }) {
    return [...this.kept.values()].filter(
      (each) => each.teamId.value === teamId.value,
    );
  }

  async due(now: Date) {
    return [...this.kept.values()].filter((each) => each.isDue(now));
  }

  async add(added: ConfigPullRequest) {
    const kept = await this.forCandidate(added.searchId, added.candidateId);

    if (kept) {
      return kept;
    }

    added.pullEvents();
    this.kept.set(added.id.value, added);

    return added;
  }

  async save(saved: ConfigPullRequest) {
    const held = this.kept.get(saved.id.value);

    if (!held || held.version !== saved.version) {
      throw new ConfigPullRequestMovedOnError(saved.id.value);
    }

    saved.pullEvents();

    if (saved.isAbandoned) {
      this.kept.delete(saved.id.value);
      return;
    }

    this.kept.set(
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
        attempts: saved.attempts,
        tries: saved.tries,
        lastCommit: saved.lastCommit,
        dueAt: saved.dueAt,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        version: saved.version + 1,
      }),
    );
  }
}
