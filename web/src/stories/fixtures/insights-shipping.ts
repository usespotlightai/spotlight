import type { QueryClient } from '@tanstack/react-query';
import { insightsShippingKeys } from '@/hooks/api/useInsightsShipping';
import type {
  ByAuthorChangesResponseDto,
  ByAuthorResponseDto,
  ByTypeResponseDto,
  DepthWeekResponseDto,
  FlowStageResponseDto,
  InsightsShippingResponseDto,
  MergeDayResponseDto,
  PercentilesResponseDto,
  PipelineFlowResponseDto,
  ReviewDayResponseDto,
  StageTimesResponseDto,
  TypeMergeResponseDto,
} from '@/lib/api';
import { DEFAULT_PERIOD } from '@/lib/insights';
import type { PullRequestType } from '@/lib/insights-pull-requests';
import {
  PERCENTILES,
  type Percentile,
  ROUNDS,
  type StationPart,
} from '@/lib/insights-shipping';
import { failQuery } from '@/stories/failQuery';
import { change, loadInsights, PERIOD } from '@/stories/fixtures/insights';
import { TEAM_ID } from '@/stories/fixtures/team';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DAYS = 30;

const dayOf = (ago: number): string =>
  new Date(Date.now() - ago * DAY_MS).toISOString().slice(0, 10);

const spreads = (p50Hours: number, count = 12): PercentilesResponseDto => ({
  p50Ms: p50Hours * HOUR_MS,
  p75Ms: p50Hours * 1.6 * HOUR_MS,
  p90Ms: p50Hours * 2.6 * HOUR_MS,
  p95Ms: p50Hours * 3.4 * HOUR_MS,
  count,
});

const NONE: PercentilesResponseDto = {
  p50Ms: null,
  p75Ms: null,
  p90Ms: null,
  p95Ms: null,
  count: 0,
};

const byAuthor = (
  spotlightHours: number,
  peopleHours: number,
): ByAuthorResponseDto => ({
  spotlight: spreads(spotlightHours),
  people: spreads(peopleHours),
});

const byAuthorChanges = (
  spotlight: number | null,
  people: number | null,
): ByAuthorChangesResponseDto => {
  const tone = (by: number | null) =>
    by === null || by > 0 ? ('bad' as const) : ('good' as const);
  const at = (by: number | null) => ({
    p50: change(by, tone(by)),
    p75: change(by, tone(by)),
    p90: change(by, tone(by)),
    p95: change(by, tone(by)),
  });

  return { spotlight: at(spotlight), people: at(people) };
};

const wave = (at: number, period: number, size: number): number =>
  Math.sin((at / period) * Math.PI * 2) * size;

const MERGE_DAYS: MergeDayResponseDto[] = Array.from(
  { length: DAYS },
  (_, at) => {
    const ago = DAYS - 1 - at;
    const easing = 1 - at / DAYS;

    return {
      day: dayOf(ago),
      daily: byAuthor(
        6 + 10 * easing + wave(at, 5, 3) + (at % 7 === 5 ? 9 : 0),
        18 + wave(at, 6, 5) + (at % 7 === 6 ? 14 : 0),
      ),
      rolling: byAuthor(
        6 + 10 * easing + wave(at, 14, 1),
        20 + wave(at, 18, 2),
      ),
    };
  },
);

const TYPES: TypeMergeResponseDto[] = [
  { type: 'feature', merged: 31, toMerge: byAuthor(14, 30) },
  { type: 'fix', merged: 22, toMerge: byAuthor(5, 11) },
  { type: 'refactor', merged: 9, toMerge: byAuthor(19, 26) },
  { type: 'tests', merged: 12, toMerge: byAuthor(3, 7) },
  { type: 'chore', merged: 17, toMerge: byAuthor(2, 4) },
  { type: 'other', merged: 4, toMerge: byAuthor(8, 15) },
];

type RoundsCounts = readonly number[];

const roundsCounts = (counts: RoundsCounts) => {
  const all = counts.reduce((sum, each) => sum + each, 0);

  return ROUNDS.map((rounds, at) => ({
    rounds,
    merged: counts[at] ?? 0,
    share: all > 0 ? (counts[at] ?? 0) / all : null,
  }));
};

const depthWeek = (
  ago: number,
  counts: RoundsCounts,
): DepthWeekResponseDto => ({
  week: dayOf(ago),
  merged: counts.reduce((sum, each) => sum + each, 0),
  rounds: roundsCounts(counts),
});

const DEPTH_COUNTS: readonly [number, RoundsCounts][] = [
  [27, [1, 4, 3, 1]],
  [20, [2, 7, 4, 1]],
  [13, [5, 11, 4, 1]],
  [6, [9, 15, 4, 1]],
];

const DEPTH: DepthWeekResponseDto[] = DEPTH_COUNTS.map(([ago, counts]) =>
  depthWeek(ago, counts),
);

const DEPTH_TOTALS = roundsCounts(
  ROUNDS.map((_, at) =>
    DEPTH_COUNTS.reduce((sum, [, counts]) => sum + (counts[at] ?? 0), 0),
  ),
);

const REVIEW_DAYS: ReviewDayResponseDto[] = Array.from(
  { length: DAYS },
  (_, at) => ({
    day: dayOf(DAYS - 1 - at),
    toFirstReviewDaily: spreads(
      3 + wave(at, 4, 1.5) + (at === 3 ? 40 : 0) + at * 0.05,
    ),
    toFirstReviewRolling: spreads(4 + wave(at, 15, 0.8)),
    awaiting: Math.round(6 + at * 0.25 + wave(at, 7, 3)),
    humanReviews: Math.max(
      0,
      Math.round(4 + wave(at, 7, 3) + (at % 7 < 5 ? 3 : -4)),
    ),
  }),
);

const MINUTE_MS = 60_000;

const PACE: Record<PullRequestType, number> = {
  feature: 1.5,
  fix: 0.7,
  refactor: 1.3,
  tests: 0.5,
  chore: 0.35,
  other: 0.9,
};

const UNJUDGED = { p50: 0, p75: 0, p90: 0, p95: 0 };

const NOT_WORST = { p50: false, p75: false, p90: false, p95: false };

const longestOf = (parts: Readonly<Record<StationPart, number>>) => {
  const longest = (Object.keys(parts) as StationPart[]).reduce(
    (most, part) => (parts[part] > parts[most] ? part : most),
    'queued' as StationPart,
  );

  return { p50: longest, p75: longest, p90: longest, p95: longest };
};

const timesOf = (
  hours: number,
  parts?: Readonly<Record<StationPart, number>>,
): StageTimesResponseDto => ({
  total: spreads(hours),
  parts: parts
    ? {
        queued: spreads(parts.queued),
        running: spreads(parts.running),
        inbox: spreads(parts.inbox),
      }
    : null,
  jam: UNJUDGED,
  worst: NOT_WORST,
  longestPart: parts ? longestOf(parts) : null,
});

const byType = (
  hours: number,
  parts?: Readonly<Record<StationPart, number>>,
  reviewHeavy = false,
): ByTypeResponseDto => ({
  all: timesOf(hours, parts),
  types: TYPES.map(({ type }) => {
    const pace =
      reviewHeavy && type === 'refactor' ? PACE[type] * 2.2 : PACE[type];
    const scaled =
      parts &&
      ({
        queued: parts.queued * pace,
        running: parts.running * pace,
        inbox: parts.inbox * pace,
      } as const);
    return { type, times: timesOf(hours * pace, scaled) };
  }),
});

const PERCENTILE_MS = {
  p50: 'p50Ms',
  p75: 'p75Ms',
  p90: 'p90Ms',
  p95: 'p95Ms',
} as const;

const jammed = (
  stages: readonly FlowStageResponseDto[],
): FlowStageResponseDto[] => {
  const judged = (
    times: StageTimesResponseDto,
    at: number,
    type: PullRequestType | null,
  ): StageTimesResponseDto => {
    const lasted = (percentile: Percentile) =>
      stages.map((stage) => {
        const typed = type
          ? stage.times.types.find((each) => each.type === type)?.times
          : stage.times.all;

        return typed?.total[PERCENTILE_MS[percentile]] ?? 0;
      });
    const of = <T>(each: (percentile: Percentile) => T) =>
      Object.fromEntries(
        PERCENTILES.map((percentile) => [percentile, each(percentile)]),
      ) as Record<Percentile, T>;

    return {
      ...times,
      jam: of((percentile) => {
        const all = lasted(percentile);
        const most = Math.max(0, ...all);
        return most === 0 ? 0 : (all[at] ?? 0) / most;
      }),
      worst: of((percentile) => {
        const all = lasted(percentile);
        return all.indexOf(Math.max(...all)) === at;
      }),
    };
  };

  return stages.map((stage, at) => ({
    ...stage,
    times: {
      all: judged(stage.times.all, at, null),
      types: stage.times.types.map((each) => ({
        type: each.type,
        times: judged(each.times, at, each.type),
      })),
    },
  }));
};

const stage = (
  kind: Exclude<FlowStageResponseDto['kind'], 'station'>,
  times: ByTypeResponseDto,
): FlowStageResponseDto => ({ kind, lineId: null, stationId: null, times });

const station = (
  stationId: string,
  times: ByTypeResponseDto,
): FlowStageResponseDto => ({
  kind: 'station',
  lineId: 'line_delivery',
  stationId,
  times,
});

const REVIEW_STAGES = [
  stage('awaitingReview', byType(10, undefined, true)),
  stage('inReview', byType(2.1)),
  stage('awaitingMerge', byType((9 * MINUTE_MS) / HOUR_MS)),
];

const PIPELINE: PipelineFlowResponseDto = {
  merged: TYPES.reduce((sum, each) => sum + each.merged, 0),
  types: TYPES.map(({ type, merged }) => ({ type, merged })),
  layouts: {
    stations: jammed([
      station(
        'station_triage',
        byType(0.4, { queued: 0.1, running: 0.2, inbox: 0.1 }),
      ),
      station(
        'station_spec',
        byType(4.2, { queued: 0.2, running: 0.5, inbox: 3.5 }),
      ),
      station(
        'station_implementation',
        byType(1.6, { queued: 0.4, running: 1.1, inbox: 0.1 }),
      ),
      station(
        'station_review',
        byType(0.9, { queued: 0.1, running: 0.3, inbox: 0.5 }, true),
      ),
      ...REVIEW_STAGES,
    ]),
    stages: jammed([stage('coding', byType(7.5)), ...REVIEW_STAGES]),
  },
};

const slowest = (percentile: Percentile): PullRequestType[] =>
  [...TYPES]
    .sort(
      (one, other) =>
        (other.toMerge.spotlight[PERCENTILE_MS[percentile]] ?? 0) -
        (one.toMerge.spotlight[PERCENTILE_MS[percentile]] ?? 0),
    )
    .map((each) => each.type);

const SHIPPING: InsightsShippingResponseDto = {
  period: PERIOD,
  truncated: false,
  toMerge: byAuthor(8.5, 21),
  toMergeChanges: byAuthorChanges(-0.39, 0.05),
  mergeDays: MERGE_DAYS,
  types: TYPES,
  slowestFirst: {
    p50: slowest('p50'),
    p75: slowest('p75'),
    p90: slowest('p90'),
    p95: slowest('p95'),
  },
  depth: DEPTH,
  depthTotals: DEPTH_TOTALS,
  reviewDays: REVIEW_DAYS,
  pipeline: PIPELINE,
  shippedAny: true,
  bots: [
    {
      login: 'coderabbitai[bot]',
      comments: 980,
      reviews: 140,
      resolvedShare: 0.18,
    },
    {
      login: 'spotlight[bot]',
      comments: 412,
      reviews: 96,
      resolvedShare: 0.61,
    },
    { login: 'copilot[bot]', comments: 233, reviews: 71, resolvedShare: 0.34 },
    {
      login: 'sonarqubecloud[bot]',
      comments: 58,
      reviews: 58,
      resolvedShare: 0.12,
    },
  ],
};

const NONE_BY_AUTHOR: ByAuthorResponseDto = { spotlight: NONE, people: NONE };

const NONE_BY_TYPE: ByTypeResponseDto = {
  all: {
    total: NONE,
    parts: null,
    jam: UNJUDGED,
    worst: NOT_WORST,
    longestPart: null,
  },
  types: [],
};

const NOTHING_REVIEWED = [
  stage('awaitingReview', NONE_BY_TYPE),
  stage('inReview', NONE_BY_TYPE),
  stage('awaitingMerge', NONE_BY_TYPE),
];

const EMPTY_SHIPPING: InsightsShippingResponseDto = {
  period: PERIOD,
  truncated: false,
  toMerge: NONE_BY_AUTHOR,
  toMergeChanges: {
    spotlight: { p50: null, p75: null, p90: null, p95: null },
    people: { p50: null, p75: null, p90: null, p95: null },
  },
  mergeDays: [],
  types: [],
  slowestFirst: { p50: [], p75: [], p90: [], p95: [] },
  depth: [],
  depthTotals: roundsCounts([0, 0, 0, 0]),
  reviewDays: [],
  bots: [],
  pipeline: {
    merged: 0,
    types: [],
    layouts: {
      stations: NOTHING_REVIEWED,
      stages: [stage('coding', NONE_BY_TYPE), ...NOTHING_REVIEWED],
    },
  },
  shippedAny: false,
};

const SHIPPING_KEY = insightsShippingKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);

export const seedShipping = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(SHIPPING_KEY, SHIPPING);
};

export const emptyShipping = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(SHIPPING_KEY, EMPTY_SHIPPING);
};

export const failShipping = (client: QueryClient) => {
  loadInsights(client);
  failQuery(client, SHIPPING_KEY);
};
