import type {
  ReplayedCandidateResponseDto,
  ReplayedCandidatesResponseDto,
  ReplayedSetResponseDto,
  ReplayedStationResponseDto,
} from '@/lib/api';
import { formatCount } from '@/lib/insights';
import { formatDay, formatPercent } from '@/lib/judge';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import { formatHeldOutRuns } from '@/lib/replay-words';
import { searchCandidatePath } from '@/lib/search';

export type InsightsCandidates = ReplayedCandidatesResponseDto;
export type CandidatesStation = ReplayedStationResponseDto;
export type CandidatesSet = ReplayedSetResponseDto;
export type SetCandidate = ReplayedCandidateResponseDto;
type CandidateKind = SetCandidate['kind'];

export const LIVE_REPLAYED = 'Live config, replayed';

const LIVE_OVER_SET = `${LIVE_REPLAYED} (whole set)`;

const liveOverSearch = (startedAt: string, searches: number): string =>
  searches === 1
    ? `${LIVE_REPLAYED} (the search’s tasks)`
    : `${LIVE_REPLAYED} (tasks of the search on ${formatDay(startedAt.slice(0, 10))})`;

export type ReplayedMark = 'baseline' | CandidateKind;

const SOURCES: Record<ReplayedMark, string> = {
  baseline: 'Live',
  searched: 'Search',
  proposed: 'Proposed',
};

export const formatSource = (mark: ReplayedMark): string => SOURCES[mark];

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

const formatHeldOutScore = (candidate: SetCandidate): string | null => {
  const heldOut = candidate.heldOut;

  return heldOut?.score == null
    ? null
    : `${formatPercent(heldOut.score)} ${formatHeldOutRuns(heldOut.runs)}`;
};

type Charted = {
  readonly key: string;
  readonly label: string;
  readonly searchId: string | null;
  readonly mark: ReplayedMark;
  readonly success: number | null;
  readonly cost: number | null;
  readonly scored: number;
  readonly frontier: boolean;
  readonly heldOut: string | null;
  readonly chartStatus: SetCandidate['chartStatus'];
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
    scored: search.seed.scored,
    frontier: true,
    heldOut: null,
    chartStatus: search.seed.chartStatus,
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
          scored: set.baseline.scored,
          frontier: false,
          heldOut: null,
          chartStatus: set.baseline.chartStatus,
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
    scored: candidate.scored,
    frontier: candidate.onFrontier === true,
    heldOut: formatHeldOutScore(candidate),
    chartStatus: candidate.chartStatus,
  })),
];

export const replayedPoints = (set: CandidatesSet): ReplayedPoint[] =>
  chartedOf(set).flatMap((each) =>
    each.chartStatus === 'priced' && each.cost !== null && each.success !== null
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
  );

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

export const stationReplayedPoints = (
  candidates: InsightsCandidates,
  stationId: string,
  currency: string | null,
): ReplayedPoint[] | null => {
  const sets = candidates.stations
    .filter((each) => each.stationId === stationId)
    .flatMap((station) => station.sets);

  return sets.length === 0
    ? null
    : sets
        .filter((set) => currency !== null && set.chartCurrency === currency)
        .flatMap(replayedPoints);
};

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

const formatRuns = (runs: number): string =>
  `${formatCount(runs)} ${runs === 1 ? 'run' : 'runs'}`;

export const formatTasks = (tasks: number, runs: number): string =>
  `${formatCount(tasks)} ${tasks === 1 ? 'task' : 'tasks'}${runs === tasks ? '' : ` (${formatRuns(runs)})`}`;

export const replayedNote = (points: readonly ReplayedPoint[]): string => {
  const scored = Math.max(0, ...points.map((each) => each.scored));

  return `Replayed points show replay success on up to ${formatRuns(scored)} of past tasks, not live outcomes. Each candidate’s own checks and judge score it. The task-size filter doesn’t apply.`;
};

export const CANDIDATES_TRUNCATED =
  'Only the latest replays in this period are counted.';

export const heldOutBrief = (candidate: SetCandidate): string => {
  const heldOut = candidate.heldOut;

  if (!heldOut) {
    return '–';
  }
  if (heldOut.score !== null) {
    return formatPercent(heldOut.score);
  }

  return heldOut.state === 'queued' || heldOut.state === 'running'
    ? 'Replaying'
    : '–';
};

export const costBasisNote = ({ shown }: SetCandidate): string | null =>
  shown.costBasis === shown.basis
    ? null
    : 'Cost is over all its scored runs. The live config is priced in another currency.';

export const formatOrigin = (candidate: SetCandidate): string =>
  candidate.kind === 'proposed' ? 'Proposed' : 'Search';

const SOURCES_NOTE =
  'Search: a search agent proposed it and replayed it on this set. Proposed: a person or Terraform proposed it, then Spotlight replayed it. Live: the station’s current config, replayed for comparison. Trophy, best value: no other config from the same search succeeded as often for less. The live config it started from didn’t either. Best value doesn’t mean it beats live. See Against live.';

export const candidateHeadings = (
  heldOut: boolean,
): readonly NestedHeading[] => [
  { label: 'Config', indent: 'inner' },
  { label: 'What changed', size: 'minmax(12rem,1.5fr)' },
  { label: 'Source', tooltip: SOURCES_NOTE },
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
  { label: 'Source', tooltip: SOURCES_NOTE, size: SPREAD },
  { label: 'Runs scored', numeric: true, size: SPREAD },
  { label: 'Cost per run', numeric: true, size: SPREAD },
  { label: 'Replay success', numeric: true, size: SPREAD },
  { label: 'Held out', numeric: true, size: SPREAD },
];

export const CANDIDATES_NOTE =
  'Each candidate config replayed on past tasks, compared with the live config on the same runs. The candidate’s own checks and judge decide success. Replays don’t change the station’s config.';
