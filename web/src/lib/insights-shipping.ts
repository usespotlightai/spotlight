import type { PullRequestType } from '@/lib/insights-pull-requests';

export const PERCENTILES = ['p50', 'p75', 'p90', 'p95'] as const;

export type Percentile = (typeof PERCENTILES)[number];

export const DEFAULT_PERCENTILE: Percentile = 'p75';

export type Spreads = Readonly<Record<Percentile, number | null>>;

export type Smoothing = 'rolling' | 'daily';

export const SMOOTHINGS: readonly { id: Smoothing; label: string }[] = [
  { id: 'rolling', label: '7-day rolling' },
  { id: 'daily', label: 'Daily' },
];

export type ByAuthor = {
  readonly spotlight: Spreads;
  readonly people: Spreads;
};

export type MergeDay = {
  readonly day: string;
  readonly daily: ByAuthor;
  readonly rolling: ByAuthor;
};

export type TypeMerge = {
  readonly type: PullRequestType;
  readonly merged: number;
  readonly toMerge: ByAuthor;
};

export const ROUNDS = ['0', '1', '2', '3+'] as const;

export type Rounds = (typeof ROUNDS)[number];

export type DepthWeek = {
  readonly week: string;
  readonly merged: number;
  readonly rounds: Readonly<Record<Rounds, number>>;
};

export type ReviewDay = {
  readonly day: string;
  readonly toFirstReview: {
    readonly daily: Spreads;
    readonly rolling: Spreads;
  };
  readonly awaiting: number;
  readonly humanReviews: number;
};

export type ReviewBot = {
  readonly login: string;
  readonly comments: number;
  readonly reviews: number;
  readonly resolvedShare: number;
};

export type InsightsShipping = {
  readonly toMerge: ByAuthor;
  readonly toMergeBefore: ByAuthor;
  readonly mergeDays: readonly MergeDay[];
  readonly types: readonly TypeMerge[];
  readonly depth: readonly DepthWeek[];
  readonly reviewDays: readonly ReviewDay[];
  readonly bots: readonly ReviewBot[];
  readonly pipeline: PipelineFlow;
};

export type MergePoint = {
  readonly day: string;
  readonly spotlight: number | null;
  readonly people: number | null;
};

export const mergePoints = (
  days: readonly MergeDay[],
  smoothing: Smoothing,
  percentile: Percentile,
): MergePoint[] =>
  days.map((each) => ({
    day: each.day,
    spotlight: each[smoothing].spotlight[percentile],
    people: each[smoothing].people[percentile],
  }));

export const slowestFirst = (
  types: readonly TypeMerge[],
  percentile: Percentile,
): TypeMerge[] =>
  [...types].sort(
    (one, other) =>
      (other.toMerge.spotlight[percentile] ?? 0) -
      (one.toMerge.spotlight[percentile] ?? 0),
  );

export type DepthBar = {
  readonly week: string;
  readonly merged: number;
} & Readonly<Record<Rounds, number>>;

export const depthBars = (weeks: readonly DepthWeek[]): DepthBar[] =>
  weeks.map((each) => {
    const total = ROUNDS.reduce((sum, rounds) => sum + each.rounds[rounds], 0);

    return {
      week: each.week,
      merged: each.merged,
      ...Object.fromEntries(
        ROUNDS.map((rounds) => [
          rounds,
          total === 0 ? 0 : each.rounds[rounds] / total,
        ]),
      ),
    } as DepthBar;
  });

const ROUNDS_SAID: Record<Rounds, string> = {
  '0': 'No review',
  '1': 'One round',
  '2': 'Two rounds',
  '3+': 'Three or more',
};

export const roundsShown = (rounds: Rounds): string => ROUNDS_SAID[rounds];

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const STEPS = [
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  2 * HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  DAY_MS,
  2 * DAY_MS,
  7 * DAY_MS,
];

const MOST_TICKS = 5;

export const durationTicks = (most: number): number[] => {
  const step =
    STEPS.find((each) => most / each <= MOST_TICKS - 1) ??
    STEPS[STEPS.length - 1];
  const top = Math.max(step, Math.ceil(most / step) * step);

  return Array.from({ length: top / step + 1 }, (_, at) => at * step);
};

export const tickLasted = (ms: number): string => {
  if (ms === 0) {
    return '0';
  }
  if (ms < HOUR_MS) {
    return `${Math.round(ms / MINUTE_MS)}m`;
  }
  if (ms < DAY_MS) {
    return `${Math.round(ms / HOUR_MS)}h`;
  }

  return `${Math.round(ms / DAY_MS)}d`;
};

export const STATION_PARTS = ['queued', 'running', 'inbox'] as const;

export type StationPart = (typeof STATION_PARTS)[number];

const PARTS_SAID: Record<StationPart, string> = {
  queued: 'queued',
  running: 'running',
  inbox: 'in the inbox',
};

export const partShown = (part: StationPart): string => PARTS_SAID[part];

export type StageTimes = {
  readonly total: Spreads;
  readonly parts?: Readonly<Record<StationPart, Spreads>>;
};

export type ByType = {
  readonly all: StageTimes;
  readonly types: Readonly<Partial<Record<PullRequestType, StageTimes>>>;
};

export const REVIEW_STAGES = [
  'awaitingReview',
  'inReview',
  'awaitingMerge',
] as const;

export type ReviewStage = (typeof REVIEW_STAGES)[number];

export type StationStage = {
  readonly stationId: string;
  readonly name: string;
  readonly times: ByType;
};

export type PipelineFlow = {
  readonly merged: number;
  readonly types: readonly {
    readonly type: PullRequestType;
    readonly merged: number;
  }[];
  readonly coding: ByType;
  readonly stations: readonly StationStage[];
  readonly review: Readonly<Record<ReviewStage, ByType>>;
};

export type FlowLayout = 'stations' | 'stages';

export const FLOW_LAYOUTS: readonly { id: FlowLayout; label: string }[] = [
  { id: 'stations', label: 'Stations' },
  { id: 'stages', label: 'Stages' },
];

const REVIEW_SAID: Record<ReviewStage, string> = {
  awaitingReview: 'Awaiting review',
  inReview: 'In review',
  awaitingMerge: 'Awaiting merge',
};

export type FlowStage = {
  readonly id: string;
  readonly label: string;
  readonly station: boolean;
  readonly ms: number | null;
  readonly parts: Readonly<Record<StationPart, number | null>> | null;
  readonly jam: number;
};

const timesFor = (
  times: ByType,
  type: PullRequestType | null,
): StageTimes | null => (type ? (times.types[type] ?? null) : times.all);

export const flowStages = (
  flow: PipelineFlow,
  layout: FlowLayout,
  percentile: Percentile,
  type: PullRequestType | null,
): FlowStage[] => {
  const before =
    layout === 'stations'
      ? flow.stations.map((each) => ({
          id: each.stationId,
          label: each.name,
          station: true,
          times: each.times,
        }))
      : [{ id: 'coding', label: 'Coding', station: false, times: flow.coding }];

  const stages = [
    ...before,
    ...REVIEW_STAGES.map((stage) => ({
      id: stage,
      label: REVIEW_SAID[stage],
      station: false,
      times: flow.review[stage],
    })),
  ].map((each) => {
    const times = timesFor(each.times, type);
    const parts = times?.parts;

    return {
      id: each.id,
      label: each.label,
      station: each.station,
      ms: times?.total[percentile] ?? null,
      parts: parts
        ? (Object.fromEntries(
            STATION_PARTS.map((part) => [part, parts[part][percentile]]),
          ) as Record<StationPart, number | null>)
        : null,
    };
  });

  const most = Math.max(0, ...stages.map((each) => each.ms ?? 0));

  return stages.map((each) => ({
    ...each,
    jam: most === 0 ? 0 : (each.ms ?? 0) / most,
  }));
};

export const worstJam = (stages: readonly FlowStage[]): FlowStage | null =>
  stages.reduce<FlowStage | null>(
    (worst, each) =>
      each.ms !== null && (worst?.ms ?? -1) < each.ms ? each : worst,
    null,
  );

export const longestPart = (stage: FlowStage): StationPart | null =>
  stage.parts
    ? STATION_PARTS.reduce((longest, part) =>
        (stage.parts?.[part] ?? 0) > (stage.parts?.[longest] ?? 0)
          ? part
          : longest,
      )
    : null;
