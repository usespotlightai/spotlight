import type {
  ByAuthorChangesResponseDto,
  ByAuthorResponseDto,
  ByTypeResponseDto,
  FlowStageResponseDto,
  InsightsShippingResponseDto,
  PercentilesResponseDto,
  RoundsCountResponseDto,
  StageTimesResponseDto,
} from '@/lib/api';
import { formatStation, type StationNames } from '@/lib/insights';
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

export type ByAuthorChanges = ByAuthorChangesResponseDto;

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
} & Readonly<Record<Rounds, number | null>>;

export type RoundsCount = RoundsCountResponseDto;

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
  readonly resolvedRate: number | null;
};

export type InsightsShipping = {
  readonly toMerge: ByAuthor;
  readonly toMergeChanges: ByAuthorChanges;
  readonly mergeDays: readonly MergeDay[];
  readonly types: readonly TypeMerge[];
  readonly slowestFirst: Readonly<
    Record<Percentile, readonly PullRequestType[]>
  >;
  readonly depth: readonly DepthWeek[];
  readonly depthTotals: readonly RoundsCount[];
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
  shipping: Pick<InsightsShipping, 'types' | 'slowestFirst'>,
  percentile: Percentile,
): TypeMerge[] =>
  shipping.slowestFirst[percentile].flatMap(
    (type) => shipping.types.find((each) => each.type === type) ?? [],
  );

const ROUNDS_TEXT: Record<Rounds, string> = {
  '0': 'No review',
  '1': 'One round',
  '2': 'Two rounds',
  '3+': 'Three or more',
};

export const formatRounds = (rounds: Rounds): string => ROUNDS_TEXT[rounds];

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

const MAX_TICKS = 5;

export const durationTicks = (max: number): number[] => {
  const step =
    STEPS.find((each) => max / each <= MAX_TICKS - 1) ??
    STEPS[STEPS.length - 1];
  const top = Math.max(step, Math.ceil(max / step) * step);

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

export const STATION_STAGES = ['queued', 'running', 'inbox'] as const;

export type StationStage = (typeof STATION_STAGES)[number];

const PARTS_TEXT: Record<StationStage, string> = {
  queued: 'queued',
  running: 'running',
  inbox: 'in the inbox',
};

export const formatPart = (part: StationStage): string => PARTS_TEXT[part];

type StageTimes = {
  readonly total: Spreads;
  readonly parts: Readonly<Record<StationStage, Spreads>> | null;
  readonly bottleneckRatio: Readonly<Record<Percentile, number>>;
  readonly worst: Readonly<Record<Percentile, boolean>>;
  readonly longestPart: Readonly<
    Record<Percentile, StationStage | null>
  > | null;
};

type ByType = {
  readonly all: StageTimes;
  readonly types: Readonly<Partial<Record<PullRequestType, StageTimes>>>;
};

type PipelineStage = {
  readonly id: string;
  readonly label: string;
  readonly station: boolean;
  readonly times: ByType;
};

export type FlowLayout = 'stations' | 'stages';

export const FLOW_LAYOUTS: readonly { id: FlowLayout; label: string }[] = [
  { id: 'stations', label: 'Stations' },
  { id: 'stages', label: 'Stages' },
];

export type PipelineFlow = {
  readonly merged: number;
  readonly types: readonly {
    readonly type: PullRequestType;
    readonly merged: number;
  }[];
  readonly layouts: Readonly<Record<FlowLayout, readonly PipelineStage[]>>;
};

type StageKind = FlowStageResponseDto['kind'];

const STAGES_TEXT: Record<StageKind, string> = {
  coding: 'Coding',
  station: 'Station',
  awaitingReview: 'Awaiting review',
  inReview: 'In review',
  awaitingMerge: 'Awaiting merge',
};

export type FlowStage = {
  readonly id: string;
  readonly label: string;
  readonly station: boolean;
  readonly ms: number | null;
  readonly parts: Readonly<Record<StationStage, number | null>> | null;
  readonly bottleneckRatio: number;
  readonly worst: boolean;
  readonly longestPart: StationStage | null;
};

export const flowStages = (
  flow: PipelineFlow,
  layout: FlowLayout,
  percentile: Percentile,
  type: PullRequestType | null,
): FlowStage[] =>
  flow.layouts[layout].map((stage) => {
    const times = type ? (stage.times.types[type] ?? null) : stage.times.all;
    const parts = times?.parts;

    return {
      id: stage.id,
      label: stage.label,
      station: stage.station,
      ms: times?.total[percentile] ?? null,
      parts: parts
        ? (Object.fromEntries(
            STATION_STAGES.map((part) => [part, parts[part][percentile]]),
          ) as Record<StationStage, number | null>)
        : null,
      bottleneckRatio: times?.bottleneckRatio[percentile] ?? 0,
      worst: times?.worst[percentile] ?? false,
      longestPart: times?.longestPart?.[percentile] ?? null,
    };
  });

const spreadsOf = (percentiles: PercentilesResponseDto): Spreads => ({
  p50: percentiles.p50Ms,
  p75: percentiles.p75Ms,
  p90: percentiles.p90Ms,
  p95: percentiles.p95Ms,
});

const byAuthorOf = (byAuthor: ByAuthorResponseDto): ByAuthor => ({
  spotlight: spreadsOf(byAuthor.spotlight),
  people: spreadsOf(byAuthor.people),
});

const stageTimesOf = (times: StageTimesResponseDto): StageTimes => ({
  total: spreadsOf(times.total),
  parts: times.parts
    ? {
        queued: spreadsOf(times.parts.queued),
        running: spreadsOf(times.parts.running),
        inbox: spreadsOf(times.parts.inbox),
      }
    : null,
  bottleneckRatio: times.bottleneckRatio,
  worst: times.worst,
  longestPart: times.longestPart,
});

const byTypeOf = (byType: ByTypeResponseDto): ByType => ({
  all: stageTimesOf(byType.all),
  types: Object.fromEntries(
    byType.types.map((each) => [each.type, stageTimesOf(each.times)]),
  ),
});

const sharesOf = (
  rounds: readonly RoundsCount[],
): Record<Rounds, number | null> =>
  Object.fromEntries(
    ROUNDS.map((each) => [
      each,
      rounds.find((counted) => counted.rounds === each)?.rate ?? null,
    ]),
  ) as Record<Rounds, number | null>;

const pipelineStageOf =
  (names: StationNames) =>
  (stage: FlowStageResponseDto): PipelineStage => ({
    id: stage.stationId ?? stage.kind,
    label: stage.stationId
      ? formatStation(names, stage.stationId)
      : STAGES_TEXT[stage.kind],
    station: stage.kind === 'station',
    times: byTypeOf(stage.times),
  });

export const shippingOf = (
  response: InsightsShippingResponseDto,
  names: StationNames,
): InsightsShipping => ({
  toMerge: byAuthorOf(response.toMerge),
  toMergeChanges: response.toMergeChanges,
  mergeDays: response.mergeDays.map((each) => ({
    day: each.day,
    daily: byAuthorOf(each.daily),
    rolling: byAuthorOf(each.rolling),
  })),
  types: response.types.map((each) => ({
    type: each.type,
    merged: each.merged,
    toMerge: byAuthorOf(each.toMerge),
  })),
  slowestFirst: response.slowestFirst,
  depth: response.depth.map((each) => ({
    week: each.week,
    merged: each.merged,
    ...sharesOf(each.rounds),
  })),
  depthTotals: response.depthTotals,
  reviewDays: response.reviewDays.map((each) => ({
    day: each.day,
    toFirstReview: {
      daily: spreadsOf(each.toFirstReviewDaily),
      rolling: spreadsOf(each.toFirstReviewRolling),
    },
    awaiting: each.awaiting,
    humanReviews: each.humanReviews,
  })),
  bots: response.bots,
  pipeline: {
    merged: response.pipeline.merged,
    types: response.pipeline.types,
    layouts: {
      stations: response.pipeline.layouts.stations.map(pipelineStageOf(names)),
      stages: response.pipeline.layouts.stages.map(pipelineStageOf(names)),
    },
  },
});
