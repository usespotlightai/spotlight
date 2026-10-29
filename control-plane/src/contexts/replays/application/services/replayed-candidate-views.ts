import type {
  ReplayedBaselineDto,
  ReplayedCandidateDto,
  ReplayedCandidatesDto,
  ReplayedSearchDto,
  ReplayedSeedDto,
  ReplayedSetDto,
  ReplayedStationDto,
  ReplaySetHealthDto,
} from '@replays/application/dto/replayed-candidates.dto';
import type { RunSummary } from '@replays/application/ports/work.port';
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
import { gainBetween } from '@replays/domain/services/gain-estimate';
import { taskComparisons } from '@replays/domain/services/replay-results';
import {
  chartCurrencyOf,
  chartStatusOf,
} from '@replays/domain/services/replayed-chart';
import { scoredOn, scoresOf } from '@replays/domain/services/search-scores';
import type { SetHealth } from '@replays/domain/services/set-health';
import {
  rankedByGain,
  shownOverLive,
} from '@replays/domain/services/shown-over-live';
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
  readonly summaries: readonly RunSummary[];
  readonly standards: ReadonlyMap<string, SetStandard>;
}

export interface SetStandard {
  readonly health: SetHealth;
  readonly minGain: number;
}

type SearchWithoutChartStatus = Omit<ReplayedSearchDto, 'seed'> & {
  readonly seed: Omit<ReplayedSeedDto, 'chartStatus'>;
};

type CandidateWithoutChartStatus = Omit<
  ReplayedCandidateDto,
  'chartStatus' | 'shown' | 'search'
> & {
  readonly search: SearchWithoutChartStatus | null;
};

interface Placed {
  readonly setId: string;
  readonly candidate: CandidateWithoutChartStatus;
}

const iso = (at: Date | null): string | null => at?.toISOString() ?? null;

const timeOf = (at: string | null): number =>
  at ? new Date(at).getTime() : Number.NEGATIVE_INFINITY;

const newestFirst = (one: string | null, other: string | null): number =>
  timeOf(other) - timeOf(one);

const newestOfTimes = (times: readonly (string | null)[]): string | null =>
  [...times].sort(newestFirst)[0] ?? null;

const newestIn = (set: ReplayedSetDto): string | null =>
  newestOfTimes(set.candidates.map((each) => each.replayedAt));

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
  summaries: readonly RunSummary[],
  standard: SetStandard,
): ReplaySetHealthDto => {
  const ended = extremes(
    summaries.flatMap((each) =>
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
): Omit<ReplayedBaselineDto, 'chartStatus'> => {
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

const gainOverReference = (
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
  | 'gainOverLive'
> => {
  const live =
    replay && baseline && !baseline.id.equals(replay.id) ? baseline : null;
  const compared = (replay && live ? taskComparisons(replay, live) : []).filter(
    (each) => each.baseline.length > 0,
  );
  const shared = compared.map((each) => RunId.of(each.original));
  const theirs = live ? scoredOn(live, shared, live.ceiling.currency) : null;
  const ours =
    replay && live ? scoredOn(replay, shared, replay.ceiling.currency) : null;

  return {
    live:
      live && theirs
        ? {
            successRate: theirs.score,
            interval: intervalView(theirs.interval),
            costPerRun: theirs.costPerRun,
            currency: live.ceiling.currency,
          }
        : null,
    successRateOnCompared: ours?.score ?? null,
    intervalOnCompared: intervalView(ours?.interval ?? null),
    costPerRunOnCompared: ours?.costPerRun ?? null,
    regressions: live ? compared.filter((each) => each.regressed).length : null,
    compared: compared.length,
    gainOverLive: gainView(
      replay && live && gainBetween(replay, live, minGain, shared),
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
): readonly CandidateWithoutChartStatus[] => {
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
        ...gainOverReference(replay, baseline, minGain),
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
      } satisfies CandidateWithoutChartStatus,
    ];
  });
};

const withChartStatus = (
  candidate: CandidateWithoutChartStatus,
  chartCurrency: string | null,
): ReplayedCandidateDto => {
  const { search } = candidate;

  return {
    ...candidate,
    search: search && {
      ...search,
      seed: {
        ...search.seed,
        chartStatus: chartStatusOf(
          {
            finished: true,
            success: search.seed.successRate,
            cost: search.seed.costPerRun,
            currency: candidate.currency,
          },
          chartCurrency,
        ),
      },
    },
    chartStatus: chartStatusOf(
      {
        finished: candidate.replayState === 'finished',
        success: candidate.successRate,
        cost: candidate.costPerRun,
        currency: candidate.currency,
      },
      chartCurrency,
    ),
    shown: shownOverLive({
      overall: {
        successRate: candidate.successRate,
        interval: candidate.interval,
        costPerRun: candidate.costPerRun,
      },
      scored: candidate.scored,
      onCompared: {
        successRate: candidate.successRateOnCompared,
        interval: candidate.intervalOnCompared,
        costPerRun: candidate.costPerRunOnCompared,
      },
      compared: candidate.compared,
      currency: candidate.currency,
      live: candidate.live,
    }),
  };
};

const setWithChartStatus = (
  baseline: Omit<ReplayedBaselineDto, 'chartStatus'> | null,
  placed: readonly CandidateWithoutChartStatus[],
): Pick<ReplayedSetDto, 'baseline' | 'chartCurrency' | 'candidates'> => {
  const newest = [...placed].sort((one, other) =>
    newestFirst(one.replayedAt, other.replayedAt),
  );
  const chartCurrency = chartCurrencyOf(
    baseline?.currency ?? null,
    newest[0]?.currency ?? null,
  );

  return {
    baseline: baseline && {
      ...baseline,
      chartStatus: chartStatusOf(
        {
          finished: baseline.state === 'finished',
          success: baseline.successRate,
          cost: baseline.costPerRun,
          currency: baseline.currency,
        },
        chartCurrency,
      ),
    },
    chartCurrency,
    candidates: rankedByGain(
      newest.map((each) => withChartStatus(each, chartCurrency)),
      (each) => each.gainOverLive?.gain ?? null,
    ),
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
        seen.period.includes(search.startedAt) &&
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
  const bySet = grouped(searched, (each) => each.setId);
  const shown = seen.sets.flatMap((set) => {
    const placed = bySet.get(set.id.value);
    const baseline = baselineAt(set.id.value);

    return placed
      ? [
          {
            station: set.station,
            set: {
              setId: set.id.value,
              stationGone: set.isAtGoneStation,
              health: healthOf(set, seen.summaries, standardOf(set.id.value)),
              ...setWithChartStatus(
                baseline ? baselineView(baseline, seen.candidates) : null,
                placed.map((each) => each.candidate),
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
  ].flatMap((atStation) => {
    const [first] = atStation;

    return first
      ? [
          {
            lineId: first.station.lineId,
            stationId: first.station.stationId,
            sets: atStation
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
