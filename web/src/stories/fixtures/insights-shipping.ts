import type { QueryClient } from '@tanstack/react-query';
import { insightsShippingKeys } from '@/hooks/api/useInsightsShipping';
import type {
  ByAuthorResponseDto,
  ByTypeResponseDto,
  DepthWeekResponseDto,
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
import type { StationPart } from '@/lib/insights-shipping';
import { failQuery } from '@/stories/failQuery';
import { loadInsights, PERIOD } from '@/stories/fixtures/insights';
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

const depthWeek = (
  ago: number,
  [none, one, two, more]: readonly [number, number, number, number],
): DepthWeekResponseDto => ({
  week: dayOf(ago),
  merged: none + one + two + more,
  rounds: [
    { rounds: '0', merged: none },
    { rounds: '1', merged: one },
    { rounds: '2', merged: two },
    { rounds: '3+', merged: more },
  ],
});

const DEPTH: DepthWeekResponseDto[] = [
  depthWeek(27, [1, 4, 3, 1]),
  depthWeek(20, [2, 7, 4, 1]),
  depthWeek(13, [5, 11, 4, 1]),
  depthWeek(6, [9, 15, 4, 1]),
];

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

const PIPELINE: PipelineFlowResponseDto = {
  merged: TYPES.reduce((sum, each) => sum + each.merged, 0),
  types: TYPES.map(({ type, merged }) => ({ type, merged })),
  coding: byType(7.5),
  stations: [
    {
      stationId: 'station_triage',
      lineId: 'line_delivery',
      times: byType(0.4, { queued: 0.1, running: 0.2, inbox: 0.1 }),
    },
    {
      stationId: 'station_spec',
      lineId: 'line_delivery',
      times: byType(4.2, { queued: 0.2, running: 0.5, inbox: 3.5 }),
    },
    {
      stationId: 'station_implementation',
      lineId: 'line_delivery',
      times: byType(1.6, { queued: 0.4, running: 1.1, inbox: 0.1 }),
    },
    {
      stationId: 'station_review',
      lineId: 'line_delivery',
      times: byType(0.9, { queued: 0.1, running: 0.3, inbox: 0.5 }, true),
    },
  ],
  awaitingReview: byType(10, undefined, true),
  inReview: byType(2.1),
  awaitingMerge: byType((9 * MINUTE_MS) / HOUR_MS),
};

const SHIPPING: InsightsShippingResponseDto = {
  period: PERIOD,
  truncated: false,
  toMerge: byAuthor(8.5, 21),
  toMergeBefore: byAuthor(14, 20),
  mergeDays: MERGE_DAYS,
  types: TYPES,
  depth: DEPTH,
  reviewDays: REVIEW_DAYS,
  pipeline: PIPELINE,
  bots: [
    {
      login: 'spotlight[bot]',
      comments: 412,
      reviews: 96,
      resolvedShare: 0.61,
    },
    {
      login: 'coderabbitai[bot]',
      comments: 980,
      reviews: 140,
      resolvedShare: 0.18,
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
  all: { total: NONE, parts: null },
  types: [],
};

const EMPTY_SHIPPING: InsightsShippingResponseDto = {
  period: PERIOD,
  truncated: false,
  toMerge: NONE_BY_AUTHOR,
  toMergeBefore: NONE_BY_AUTHOR,
  mergeDays: [],
  types: [],
  depth: [],
  reviewDays: [],
  bots: [],
  pipeline: {
    merged: 0,
    types: [],
    coding: NONE_BY_TYPE,
    stations: [],
    awaitingReview: NONE_BY_TYPE,
    inReview: NONE_BY_TYPE,
    awaitingMerge: NONE_BY_TYPE,
  },
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
