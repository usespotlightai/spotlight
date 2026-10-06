import type {
  ReplayedBaselineDto,
  ReplayedCandidateDto,
  ReplayedCandidatesDto,
  ReplayedSetDto,
  ReplayedStationDto,
  ReplaySetHealthDto,
} from '@replays/application/dto/replayed-candidates.dto';
import type { StandingRun } from '@replays/application/ports/work.port';
import { candidatePullRequestView } from '@replays/application/services/config-pull-request-views';
import {
  gainView,
  healthView,
  intervalView,
} from '@replays/application/services/replay-views';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { baselineOf } from '@replays/domain/services/baseline';
import { frontierOf } from '@replays/domain/services/frontier';
import { gainBetween } from '@replays/domain/services/gain-reading';
import { comparedWith } from '@replays/domain/services/replay-results';
import { scoredOn, scoresOf } from '@replays/domain/services/search-scores';
import type { SetHealth } from '@replays/domain/services/set-health';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayedPeriod } from '@replays/domain/value-objects/replayed-period.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayedCandidatesSeen {
  readonly period: ReplayedPeriod;
  readonly truncated: boolean;
  readonly recent: readonly Replay[];
  readonly searches: readonly Search[];
  readonly searchReplays: readonly Replay[];
  readonly sets: readonly ReplaySet[];
  readonly baselines: readonly Replay[];
  readonly candidates: readonly Candidate[];
  readonly pullRequests: readonly ConfigPullRequest[];
  readonly standing: readonly StandingRun[];
  readonly standards: ReadonlyMap<string, SetStandard>;
}

export interface SetStandard {
  readonly health: SetHealth;
  readonly minGain: number;
}

interface Placed {
  readonly setId: string;
  readonly candidate: ReplayedCandidateDto;
}

const iso = (at: Date | null): string | null => at?.toISOString() ?? null;

const timeOf = (at: string | null): number =>
  at ? new Date(at).getTime() : Number.NEGATIVE_INFINITY;

const newestFirst = (one: string | null, other: string | null): number =>
  timeOf(other) - timeOf(one);

const newestIn = (set: ReplayedSetDto): string | null =>
  set.candidates[0]?.replayedAt ?? null;

const newestOf = (station: ReplayedStationDto): string | null =>
  station.sets[0] ? newestIn(station.sets[0]) : null;

const extremes = (
  times: readonly Date[],
): { oldest: Date | null; newest: Date | null } => {
  const sorted = [...times].sort(
    (one, other) => one.getTime() - other.getTime(),
  );

  return {
    oldest: sorted[0] ?? null,
    newest: sorted[sorted.length - 1] ?? null,
  };
};

const healthOf = (
  set: ReplaySet,
  standing: readonly StandingRun[],
  standard: SetStandard,
): ReplaySetHealthDto => {
  const ended = extremes(
    standing.flatMap((each) =>
      each.endedAt && set.runs.some((run) => run.equals(each.runId))
        ? [each.endedAt]
        : [],
    ),
  );

  return {
    tasks: tasksIn(set.entries.map((each) => each.taskId)),
    runs: set.entries.length,
    oldestRunEndedAt: iso(ended.oldest),
    newestRunEndedAt: iso(ended.newest),
    lastAddedAt: iso(extremes(set.entries.map((each) => each.addedAt)).newest),
    ...healthView(standard.health),
    minGain: standard.minGain,
  };
};

const baselineView = (
  baseline: Replay,
  candidates: readonly Candidate[],
): ReplayedBaselineDto => {
  const currency = baseline.ceiling.currency;
  const scored = scoredOn(baseline, null, currency);

  return {
    replayId: baseline.id.value,
    state: baseline.current,
    fingerprint:
      candidates.find((each) => each.id.equals(baseline.candidateId))
        ?.fingerprint.value ?? null,
    scored: scored.scored,
    successRate: scored.score,
    interval: intervalView(scored.interval),
    costPerRun: scored.costPerRun,
    currency,
    endedAt: iso(baseline.endedAt),
  };
};

const againstBaseline = (
  replay: Replay | null,
  baseline: Replay | null,
  minGain: number,
): Pick<
  ReplayedCandidateDto,
  | 'live'
  | 'successRateOnCompared'
  | 'intervalOnCompared'
  | 'costPerRunOnCompared'
  | 'regressions'
  | 'compared'
  | 'againstLive'
> => {
  const against =
    replay && baseline && !baseline.id.equals(replay.id) ? baseline : null;
  const compared = (
    replay && against ? comparedWith(replay, against) : []
  ).filter((each) => each.baseline.length > 0);
  const shared = compared.map((each) => RunId.of(each.original));
  const live = against
    ? scoredOn(against, shared, against.ceiling.currency)
    : null;
  const ours =
    replay && against
      ? scoredOn(replay, shared, replay.ceiling.currency)
      : null;

  return {
    live:
      against && live
        ? {
            successRate: live.score,
            interval: intervalView(live.interval),
            costPerRun: live.costPerRun,
            currency: against.ceiling.currency,
          }
        : null,
    successRateOnCompared: ours?.score ?? null,
    intervalOnCompared: intervalView(ours?.interval ?? null),
    costPerRunOnCompared: ours?.costPerRun ?? null,
    regressions: against
      ? compared.filter((each) => each.regressed).length
      : null,
    compared: compared.length,
    againstLive: gainView(
      replay && against && gainBetween(replay, against, minGain, shared),
    ),
  };
};

const tasksIn = (tasks: readonly { value: string }[]): number =>
  new Set(tasks.map((each) => each.value)).size;

const changesOf = (candidate: Candidate | null) =>
  candidate?.changedFrom.changes.map((change) => ({ ...change })) ?? [];

const searchedOf = (
  search: Search,
  searchReplays: readonly Replay[],
  candidates: readonly Candidate[],
  pullRequests: readonly ConfigPullRequest[],
  baseline: Replay | null,
  minGain: number,
): readonly ReplayedCandidateDto[] => {
  const scores = scoresOf(search, searchReplays, minGain);
  const frontier = frontierOf(
    [scores.seed, ...scores.candidates],
    search.objective,
  );
  const currency = search.budget.ceiling.currency;
  const found = (id: ReplayId | null): Replay | null =>
    (id && searchReplays.find((each) => each.id.equals(id))) || null;
  const pullRequestOf = (id: CandidateId) => {
    const opened = pullRequests.find(
      (each) => each.searchId.equals(search.id) && each.candidateId.equals(id),
    );

    return opened ? candidatePullRequestView(opened) : null;
  };

  return search.proposals.flatMap((proposal, at) => {
    const each = scores.candidates[at];

    if (!each) {
      return [];
    }

    const candidate =
      candidates.find((one) => one.id.equals(each.candidateId)) ?? null;
    const replay = found(each.replayId);
    const heldOut = found(each.heldOutReplayId);

    return [
      {
        candidateId: each.candidateId.value,
        name: proposal.name.value,
        kind: 'searched',
        hypothesis: candidate?.search?.hypothesis.value ?? null,
        fingerprint: candidate?.fingerprint.value ?? null,
        changes: changesOf(candidate),
        replayId: each.replayId.value,
        replayState: replay?.current ?? null,
        replayedAt: iso(replay?.startedAt ?? null),
        tasks: search.split.searchedTasks,
        runs: search.split.searched.length,
        successRate: each.searchScore,
        interval: intervalView(each.searchInterval),
        scored: each.searchScored,
        heldOut: each.heldOutReplayId
          ? {
              replayId: each.heldOutReplayId.value,
              state: heldOut?.current ?? null,
              score: each.heldOutScore,
              interval: intervalView(each.heldOutInterval),
              tasks: search.split.heldOutTasks,
              runs: scoredOn(heldOut, search.split.heldOutRuns, currency)
                .scored,
            }
          : null,
        costPerRun: each.costPerRun,
        currency,
        ...againstBaseline(replay, baseline, minGain),
        onFrontier: frontier.some((one) =>
          one.candidateId.equals(each.candidateId),
        ),
        search: {
          searchId: search.id.value,
          state: search.current,
          objective: search.objective,
          startedAt: search.startedAt.toISOString(),
          seed: {
            successRate: scores.seed.searchScore,
            interval: intervalView(scores.seed.searchInterval),
            costPerRun: scores.seed.costPerRun,
            scored: scores.seed.searchScored,
          },
        },
        pullRequest: pullRequestOf(each.candidateId),
      } satisfies ReplayedCandidateDto,
    ];
  });
};

const proposedOf = (
  replay: Replay,
  candidate: Candidate,
  baseline: Replay | null,
  minGain: number,
): ReplayedCandidateDto => {
  const currency = replay.ceiling.currency;
  const scored = scoredOn(replay, null, currency);

  return {
    candidateId: candidate.id.value,
    name: candidate.name.value,
    kind: 'proposed',
    hypothesis: null,
    fingerprint: candidate.fingerprint.value,
    changes: changesOf(candidate),
    replayId: replay.id.value,
    replayState: replay.current,
    replayedAt: replay.startedAt.toISOString(),
    tasks: tasksIn(replay.entries.map((each) => each.taskId)),
    runs: replay.originals.length,
    successRate: scored.score,
    interval: intervalView(scored.interval),
    scored: scored.scored,
    heldOut: null,
    costPerRun: scored.costPerRun,
    currency,
    ...againstBaseline(replay, baseline, minGain),
    onFrontier: null,
    search: null,
    pullRequest: null,
  };
};

const grouped = <Item>(
  items: readonly Item[],
  keyOf: (item: Item) => string,
): ReadonlyMap<string, readonly Item[]> => {
  const groups = new Map<string, Item[]>();

  for (const each of items) {
    groups.set(keyOf(each), [...(groups.get(keyOf(each)) ?? []), each]);
  }

  return groups;
};

export const replayedCandidatesView = (
  seen: ReplayedCandidatesSeen,
): ReplayedCandidatesDto => {
  const baselines = new Map(
    seen.sets.map((set) => [
      set.id.value,
      baselineOf(seen.baselines.filter((each) => each.setId.equals(set.id))),
    ]),
  );
  const baselineAt = (setId: string) => baselines.get(setId) ?? null;
  const standardOf = (setId: string): SetStandard => {
    const standard = seen.standards.get(setId);

    if (!standard) {
      throw new InconsistentStateError(
        'replayed candidates',
        `read set ${setId} without its live standard`,
      );
    }

    return standard;
  };
  const searched: Placed[] = seen.searches
    .filter(
      (search) =>
        seen.period.holds(search.startedAt) &&
        baselines.has(search.setId.value),
    )
    .flatMap((search) =>
      searchedOf(
        search,
        seen.searchReplays,
        seen.candidates,
        seen.pullRequests,
        baselineAt(search.setId.value),
        standardOf(search.setId.value).minGain,
      ).map((candidate) => ({ setId: search.setId.value, candidate })),
    );
  const proposedReplays = grouped(
    seen.recent.filter(
      (replay) =>
        seen.period.holds(replay.startedAt) &&
        baselines.has(replay.setId.value) &&
        seen.candidates.some(
          (each) => each.isProposed && each.id.equals(replay.candidateId),
        ),
    ),
    (replay) => `${replay.setId.value}:${replay.candidateId.value}`,
  );
  const proposed: Placed[] = [...proposedReplays.values()].flatMap((held) => {
    const replay = held.find((each) => each.current === 'finished') ?? held[0];
    const candidate = seen.candidates.find((each) =>
      each.id.equals(replay?.candidateId ?? null),
    );

    return replay && candidate
      ? [
          {
            setId: replay.setId.value,
            candidate: proposedOf(
              replay,
              candidate,
              baselineAt(replay.setId.value),
              standardOf(replay.setId.value).minGain,
            ),
          },
        ]
      : [];
  });

  const bySet = grouped([...searched, ...proposed], (each) => each.setId);
  const shown = seen.sets.flatMap((set) => {
    const placed = bySet.get(set.id.value);
    const baseline = baselineAt(set.id.value);

    return placed
      ? [
          {
            station: set.station,
            set: {
              setId: set.id.value,
              name: set.name.value,
              stationGone: set.isAtGoneStation,
              guardsChanges: set.guardsChanges,
              health: healthOf(set, seen.standing, standardOf(set.id.value)),
              baseline: baseline
                ? baselineView(baseline, seen.candidates)
                : null,
              candidates: placed
                .map((each) => each.candidate)
                .sort((one, other) =>
                  newestFirst(one.replayedAt, other.replayedAt),
                ),
            },
          },
        ]
      : [];
  });
  const stations: ReplayedStationDto[] = [
    ...grouped(
      shown,
      (each) => `${each.station.lineId}:${each.station.stationId}`,
    ).values(),
  ].flatMap((held) => {
    const [first] = held;

    return first
      ? [
          {
            lineId: first.station.lineId,
            stationId: first.station.stationId,
            sets: held
              .map((each) => each.set)
              .sort((one, other) =>
                newestFirst(newestIn(one), newestIn(other)),
              ),
          },
        ]
      : [];
  });

  return {
    period: {
      name: seen.period.name,
      from: seen.period.from.toISOString(),
      to: seen.period.to.toISOString(),
    },
    truncated: seen.truncated,
    stations: stations.sort((one, other) =>
      newestFirst(newestOf(one), newestOf(other)),
    ),
  };
};
