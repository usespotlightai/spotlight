import type {
  ReplayedCandidateResponseDto,
  ReplayedCandidatesResponseDto,
  ReplayedSetResponseDto,
  ReplayedStationResponseDto,
  ReplaySetHealthResponseDto,
} from '@/lib/api';
import { spentIn } from '@/lib/inbox';
import { countShown } from '@/lib/insights';
import { dayShown, percentShown } from '@/lib/judge';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import {
  heldOutRunsShown,
  type ReplayState,
  stateShown,
} from '@/lib/replay-words';
import { regressionsShown, searchCandidatePath } from '@/lib/search';

export type InsightsCandidates = ReplayedCandidatesResponseDto;
export type CandidatesStation = ReplayedStationResponseDto;
export type CandidatesSet = ReplayedSetResponseDto;
export type SetCandidate = ReplayedCandidateResponseDto;
type SetHealth = ReplaySetHealthResponseDto;
type CandidateKind = SetCandidate['kind'];

export const LIVE_REPLAYED = 'Live config, replayed';

const LIVE_OVER_SET = `${LIVE_REPLAYED} (whole set)`;

const liveOverSearch = (startedAt: string, searches: number): string =>
  searches === 1
    ? `${LIVE_REPLAYED} (the search’s tasks)`
    : `${LIVE_REPLAYED} (tasks of the search on ${dayShown(startedAt.slice(0, 10))})`;

export type ReplayedMark = 'baseline' | CandidateKind;

const SOURCES: Record<ReplayedMark, string> = {
  baseline: 'Live',
  searched: 'Search',
  proposed: 'Proposed',
};

export const sourceShown = (mark: ReplayedMark): string => SOURCES[mark];

export type ReplayedSet = {
  readonly name: string;
  readonly points: readonly ReplayedPoint[];
};

export const replayedSetsOf = (
  points: readonly ReplayedPoint[],
): ReplayedSet[] => {
  const grouped = new Map<string, ReplayedPoint[]>();

  for (const point of points) {
    grouped.set(point.setName, [...(grouped.get(point.setName) ?? []), point]);
  }

  return [...grouped].map(([name, each]) => ({ name, points: each }));
};

export type ReplayedPoint = {
  readonly key: string;
  readonly label: string;
  readonly setName: string;
  readonly searchId: string | null;
  readonly mark: ReplayedMark;
  readonly cost: number;
  readonly value: number;
  readonly scored: number;
  readonly frontier: boolean;
  readonly heldOut: string | null;
};

type UnchartedCandidate = {
  readonly key: string;
  readonly label: string;
  readonly note: string | null;
};

export type ReplayedChart = {
  readonly priced: readonly ReplayedPoint[];
  readonly unpriced: readonly UnchartedCandidate[];
  readonly otherCurrency: readonly UnchartedCandidate[];
  readonly unscored: readonly UnchartedCandidate[];
  readonly unfinished: readonly UnchartedCandidate[];
};

export const setCurrency = (set: CandidatesSet): string | null =>
  set.baseline?.currency ?? set.candidates[0]?.currency ?? null;

export const heldOutShown = (candidate: SetCandidate): string | null => {
  if (!candidate.heldOut) {
    return candidate.kind === 'searched' ? 'Not held out' : null;
  }

  const { state } = candidate.heldOut;

  return state === 'queued' || state === 'running' ? 'Replaying' : '–';
};

const heldOutScoreShown = (candidate: SetCandidate): string | null => {
  const heldOut = candidate.heldOut;

  return heldOut?.score == null
    ? null
    : `${percentShown(heldOut.score)} ${heldOutRunsShown(heldOut.runs)}`;
};

type Charted = {
  readonly key: string;
  readonly label: string;
  readonly searchId: string | null;
  readonly mark: ReplayedMark;
  readonly success: number | null;
  readonly cost: number | null;
  readonly currency: string;
  readonly scored: number;
  readonly frontier: boolean;
  readonly heldOut: string | null;
  readonly state: ReplayState | null;
};

const searchesOf = (
  set: CandidatesSet,
): NonNullable<SetCandidate['search']>[] => [
  ...new Map(
    set.candidates.flatMap((each) =>
      each.search ? [[each.search.searchId, each.search] as const] : [],
    ),
  ).values(),
];

const seedsOf = (set: CandidatesSet): Charted[] => {
  const searches = searchesOf(set);

  return searches.map((search) => ({
    key: `${set.setId}:seed:${search.searchId}`,
    label: liveOverSearch(search.startedAt, searches.length),
    searchId: search.searchId,
    mark: 'baseline' as const,
    success: search.seed.successRate,
    cost: search.seed.costPerRun,
    currency:
      set.candidates.find((each) => each.search?.searchId === search.searchId)
        ?.currency ?? '',
    scored: search.seed.scored,
    frontier: true,
    heldOut: null,
    state: 'finished' as const,
  }));
};

const chartedOf = (set: CandidatesSet): Charted[] => [
  ...(set.baseline && set.candidates.some((each) => each.kind === 'proposed')
    ? [
        {
          key: `${set.setId}:live`,
          label: LIVE_OVER_SET,
          searchId: null,
          mark: 'baseline' as const,
          success: set.baseline.successRate,
          cost: set.baseline.costPerRun,
          currency: set.baseline.currency,
          scored: set.baseline.scored,
          frontier: false,
          heldOut: null,
          state: 'finished' as const,
        },
      ]
    : []),
  ...seedsOf(set),
  ...set.candidates.map((candidate) => ({
    key: `${set.setId}:${candidate.candidateId}`,
    label: candidate.name,
    searchId: candidate.search?.searchId ?? null,
    mark: candidate.kind,
    success: candidate.successRate,
    cost: candidate.costPerRun,
    currency: candidate.currency,
    scored: candidate.scored,
    frontier: candidate.onFrontier === true,
    heldOut: heldOutScoreShown(candidate),
    state: candidate.replayState,
  })),
];

export const replayedChart = (
  set: CandidatesSet,
  currency: string | null,
): ReplayedChart => {
  const all = chartedOf(set);
  const charted = all.filter((each) => each.state === 'finished');
  const scored = charted.flatMap((each) =>
    each.success === null ? [] : [{ ...each, success: each.success }],
  );
  const uncharted = (each: Charted): UnchartedCandidate => ({
    key: each.key,
    label: each.label,
    note: each.success === null ? null : percentShown(each.success),
  });

  return {
    priced: scored.flatMap((each) =>
      each.cost !== null && each.currency === currency
        ? [
            {
              key: each.key,
              label: each.label,
              setName: set.name,
              searchId: each.searchId,
              mark: each.mark,
              cost: each.cost,
              value: each.success,
              scored: each.scored,
              frontier: each.frontier,
              heldOut: each.heldOut,
            },
          ]
        : [],
    ),
    unpriced: scored.filter((each) => each.cost === null).map(uncharted),
    otherCurrency: scored
      .filter((each) => each.cost !== null && each.currency !== currency)
      .map(uncharted),
    unscored: charted.filter((each) => each.success === null).map(uncharted),
    unfinished: all
      .filter((each) => each.state !== 'finished')
      .map((each) => ({
        key: each.key,
        label: each.label,
        note: each.state ? stateShown(each.state).toLowerCase() : 'gone',
      })),
  };
};

export const replayedFrontiersOf = (
  points: readonly ReplayedPoint[],
): ReplayedPoint[][] => {
  const bySearch = new Map<string, ReplayedPoint[]>();

  for (const point of points) {
    if (point.frontier && point.searchId) {
      bySearch.set(point.searchId, [
        ...(bySearch.get(point.searchId) ?? []),
        point,
      ]);
    }
  }

  return [...bySearch.values()].map((each) =>
    [...each].sort((one, other) => one.cost - other.cost),
  );
};

export const stationReplayedChart = (
  candidates: InsightsCandidates,
  stationId: string,
  currency: string | null,
): ReplayedChart => {
  const charts = candidates.stations
    .filter((each) => each.stationId === stationId)
    .flatMap((station) =>
      station.sets.map((set) => replayedChart(set, currency)),
    );

  return {
    priced: charts.flatMap((each) => each.priced),
    unpriced: charts.flatMap((each) => each.unpriced),
    otherCurrency: charts.flatMap((each) => each.otherCurrency),
    unscored: charts.flatMap((each) => each.unscored),
    unfinished: charts.flatMap((each) => each.unfinished),
  };
};

export const chartedNothing = (chart: ReplayedChart): boolean =>
  chart.priced.length === 0 &&
  chart.unpriced.length === 0 &&
  chart.otherCurrency.length === 0 &&
  chart.unscored.length === 0 &&
  chart.unfinished.length === 0;

export const candidatesAt = (
  slug: string,
  teamId: string,
  station: CandidatesStation,
): ReplayedStation => ({
  slug,
  teamId,
  lineId: station.lineId,
  stationId: station.stationId,
});

type ChangeLink = {
  readonly to: string;
  readonly external: boolean;
};

export const changeLinkOf = (
  at: ReplayedStation,
  candidate: SetCandidate,
): ChangeLink => {
  const pullRequest = candidate.pullRequest;

  if (pullRequest?.state === 'opened' && pullRequest.url) {
    return { to: pullRequest.url, external: true };
  }

  if (candidate.kind === 'searched' && candidate.search) {
    return {
      to: searchCandidatePath(
        at,
        candidate.search.searchId,
        candidate.candidateId,
      ),
      external: false,
    };
  }

  return {
    to: replayPath(at, candidate.replayId),
    external: false,
  };
};

const runsShown = (runs: number): string =>
  `${countShown(runs)} ${runs === 1 ? 'run' : 'runs'}`;

export const onTheSameShown = (compared: number): string =>
  `on the same ${runsShown(compared)}`;

export const costAgainstLiveShown = (
  candidate: SetCandidate,
): string | null => {
  const live = candidate.live;
  const own = candidate.costPerRunOnCompared;

  return live &&
    live.costPerRun !== null &&
    own !== null &&
    live.currency === candidate.currency
    ? `cost ${spentIn(own, candidate.currency)} vs live ${spentIn(live.costPerRun, live.currency)} a run on the same ${runsShown(candidate.compared)}`
    : null;
};

export const comparedShown = (candidate: SetCandidate): string => {
  if (candidate.regressions === null) {
    return 'No baseline to compare with';
  }
  if (candidate.compared === 0) {
    return 'No runs compared yet';
  }

  return `${regressionsShown(candidate.regressions)} over ${runsShown(candidate.compared)} compared`;
};

export const tasksShown = (tasks: number, runs: number): string =>
  `${countShown(tasks)} ${tasks === 1 ? 'task' : 'tasks'}${runs === tasks ? '' : ` (${runsShown(runs)})`}`;

const DAY_MS = 86_400_000;

const utcDay = (at: number): number => Math.floor(at / DAY_MS);

const daysSince = (at: string, now: Date): number =>
  Math.max(0, utcDay(now.getTime()) - utcDay(new Date(at).getTime()));

const agoShown = (days: number): string => {
  if (days === 0) {
    return 'today';
  }

  return days === 1 ? '1 day ago' : `${countShown(days)} days ago`;
};

const endedShown = (newest: number, oldest: number): string => {
  if (newest === oldest) {
    return `ended ${agoShown(newest)}`;
  }

  return newest === 0
    ? `ended today to ${agoShown(oldest)}`
    : `ended ${countShown(newest)}–${agoShown(oldest)}`;
};

export const healthShown = (health: SetHealth, now: Date): string => {
  if (health.tasks === 0) {
    return 'No tasks yet';
  }

  return [
    tasksShown(health.tasks, health.runs),
    ...(health.oldestRunEndedAt && health.newestRunEndedAt
      ? [
          endedShown(
            daysSince(health.newestRunEndedAt, now),
            daysSince(health.oldestRunEndedAt, now),
          ),
        ]
      : []),
    ...(health.lastAddedAt
      ? [`last added ${agoShown(daysSince(health.lastAddedAt, now))}`]
      : []),
  ].join(' · ');
};

export const replayedNote = (points: readonly ReplayedPoint[]): string => {
  const scored = Math.max(0, ...points.map((each) => each.scored));

  return `Replayed points show replay success on up to ${runsShown(scored)} of past tasks, not live outcomes. Scored by each candidate’s own checks and judge. The task-size filter doesn’t apply.`;
};

export const CANDIDATES_TRUNCATED =
  'Only the latest replays in this period are counted.';

export const rankedCandidates = (set: CandidatesSet): SetCandidate[] =>
  [...set.candidates].sort(
    (a, b) =>
      (b.againstLive?.gain ?? Number.NEGATIVE_INFINITY) -
      (a.againstLive?.gain ?? Number.NEGATIVE_INFINITY),
  );

export type ComparedRates = {
  readonly own: number | null;
  readonly interval: SetCandidate['interval'];
  readonly live: number | null;
  readonly runs: number;
};

export const comparedRates = (candidate: SetCandidate): ComparedRates =>
  candidate.live && candidate.compared > 0
    ? {
        own: candidate.successRateOnCompared,
        interval: candidate.intervalOnCompared,
        live: candidate.live.successRate,
        runs: candidate.compared,
      }
    : {
        own: candidate.successRate,
        interval: candidate.interval,
        live: null,
        runs: candidate.scored,
      };

export type ComparedCosts = {
  readonly own: number | null;
  readonly live: number | null;
};

export const comparedCosts = (candidate: SetCandidate): ComparedCosts => {
  const live = candidate.live;

  return live && candidate.compared > 0 && live.currency === candidate.currency
    ? { own: candidate.costPerRunOnCompared, live: live.costPerRun }
    : { own: candidate.costPerRun, live: null };
};

export const heldOutBrief = (candidate: SetCandidate): string => {
  const heldOut = candidate.heldOut;

  if (!heldOut) {
    return '–';
  }
  if (heldOut.score !== null) {
    return percentShown(heldOut.score);
  }

  return heldOut.state === 'queued' || heldOut.state === 'running'
    ? 'Replaying'
    : '–';
};

export const originShown = (candidate: SetCandidate): string =>
  candidate.kind === 'proposed' ? 'Proposed' : 'Search';

const SOURCES_NOTE =
  'Search: a search agent proposed it and replayed it on this set. Proposed: put forward by a person or Terraform, then replayed. Live: the station’s current config, replayed to compare with. Trophy, best value: no other config from the same search, nor the live config it started from, succeeded as often for less. Not the same as beating live; see Against live.';

export const candidateHeadings = (
  heldOut: boolean,
): readonly NestedHeading[] => [
  { label: 'Config', indent: 'inner' },
  { label: 'What changed', size: 'minmax(12rem,1.5fr)' },
  { label: 'Source', note: SOURCES_NOTE },
  { label: 'Replay success', size: 'minmax(8rem,1fr)' },
  { label: 'Candidate', numeric: true },
  { label: 'Live', numeric: true },
  { label: 'Against live' },
  { label: 'Cost per run', numeric: true },
  { label: 'Live cost', numeric: true },
  ...(heldOut ? [{ label: 'Held out', numeric: true }] : []),
  { label: 'Runs', numeric: true },
];

export const REPLAYED_HEADINGS: readonly NestedHeading[] = [
  { label: 'Config', indent: 'outer', size: 'minmax(12rem,2fr)' },
  { label: 'Source', note: SOURCES_NOTE, size: SPREAD },
  { label: 'Runs scored', numeric: true, size: SPREAD },
  { label: 'Cost per run', numeric: true, size: SPREAD },
  { label: 'Replay success', numeric: true, size: SPREAD },
  { label: 'Held out', numeric: true, size: SPREAD },
];
