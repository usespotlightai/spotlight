import type { PullRequestType } from '@/lib/insights-pull-requests';
import type {
  ByAuthor,
  ByType,
  DepthWeek,
  InsightsShipping,
  MergeDay,
  PipelineFlow,
  ReviewDay,
  Spreads,
  StageTimes,
  StationPart,
  TypeMerge,
} from '@/lib/insights-shipping';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DAYS = 30;

const dayOf = (ago: number): string =>
  new Date(Date.now() - ago * DAY_MS).toISOString().slice(0, 10);

const spreads = (p50Hours: number): Spreads => ({
  p50: p50Hours * HOUR_MS,
  p75: p50Hours * 1.6 * HOUR_MS,
  p90: p50Hours * 2.6 * HOUR_MS,
  p95: p50Hours * 3.4 * HOUR_MS,
});

const byAuthor = (spotlightHours: number, peopleHours: number): ByAuthor => ({
  spotlight: spreads(spotlightHours),
  people: spreads(peopleHours),
});

const wave = (at: number, period: number, size: number): number =>
  Math.sin((at / period) * Math.PI * 2) * size;

const MERGE_DAYS: MergeDay[] = Array.from({ length: DAYS }, (_, at) => {
  const ago = DAYS - 1 - at;
  const easing = 1 - at / DAYS;

  return {
    day: dayOf(ago),
    daily: byAuthor(
      6 + 10 * easing + wave(at, 5, 3) + (at % 7 === 5 ? 9 : 0),
      18 + wave(at, 6, 5) + (at % 7 === 6 ? 14 : 0),
    ),
    rolling: byAuthor(6 + 10 * easing + wave(at, 14, 1), 20 + wave(at, 18, 2)),
  };
});

const TYPES: TypeMerge[] = [
  { type: 'feature', merged: 31, toMerge: byAuthor(14, 30) },
  { type: 'fix', merged: 22, toMerge: byAuthor(5, 11) },
  { type: 'refactor', merged: 9, toMerge: byAuthor(19, 26) },
  { type: 'tests', merged: 12, toMerge: byAuthor(3, 7) },
  { type: 'chore', merged: 17, toMerge: byAuthor(2, 4) },
  { type: 'other', merged: 4, toMerge: byAuthor(8, 15) },
];

const DEPTH: DepthWeek[] = [
  { week: dayOf(27), merged: 9, rounds: { 0: 1, 1: 4, 2: 3, '3+': 1 } },
  { week: dayOf(20), merged: 14, rounds: { 0: 2, 1: 7, 2: 4, '3+': 1 } },
  { week: dayOf(13), merged: 21, rounds: { 0: 5, 1: 11, 2: 4, '3+': 1 } },
  { week: dayOf(6), merged: 29, rounds: { 0: 9, 1: 15, 2: 4, '3+': 1 } },
];

const REVIEW_DAYS: ReviewDay[] = Array.from({ length: DAYS }, (_, at) => ({
  day: dayOf(DAYS - 1 - at),
  toFirstReview: {
    daily: spreads(3 + wave(at, 4, 1.5) + (at === 3 ? 40 : 0) + at * 0.05),
    rolling: spreads(4 + wave(at, 15, 0.8)),
  },
  awaiting: Math.round(6 + at * 0.25 + wave(at, 7, 3)),
  humanReviews: Math.max(
    0,
    Math.round(4 + wave(at, 7, 3) + (at % 7 < 5 ? 3 : -4)),
  ),
}));

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
): StageTimes => ({
  total: spreads(hours),
  parts: parts && {
    queued: spreads(parts.queued),
    running: spreads(parts.running),
    inbox: spreads(parts.inbox),
  },
});

const byType = (
  hours: number,
  parts?: Readonly<Record<StationPart, number>>,
  reviewHeavy = false,
): ByType => ({
  all: timesOf(hours, parts),
  types: Object.fromEntries(
    TYPES.map(({ type }) => {
      const pace =
        reviewHeavy && type === 'refactor' ? PACE[type] * 2.2 : PACE[type];
      const scaled =
        parts &&
        ({
          queued: parts.queued * pace,
          running: parts.running * pace,
          inbox: parts.inbox * pace,
        } as const);
      return [type, timesOf(hours * pace, scaled)];
    }),
  ),
});

const PIPELINE: PipelineFlow = {
  merged: TYPES.reduce((sum, each) => sum + each.merged, 0),
  types: TYPES.map(({ type, merged }) => ({ type, merged })),
  coding: byType(7.5),
  stations: [
    {
      stationId: 'station_triage',
      name: 'Triage',
      times: byType(0.4, { queued: 0.1, running: 0.2, inbox: 0.1 }),
    },
    {
      stationId: 'station_spec',
      name: 'Spec',
      times: byType(4.2, { queued: 0.2, running: 0.5, inbox: 3.5 }),
    },
    {
      stationId: 'station_implementation',
      name: 'Implementation',
      times: byType(1.6, { queued: 0.4, running: 1.1, inbox: 0.1 }),
    },
    {
      stationId: 'station_review',
      name: 'Code Review',
      times: byType(0.9, { queued: 0.1, running: 0.3, inbox: 0.5 }, true),
    },
  ],
  review: {
    awaitingReview: byType(10, undefined, true),
    inReview: byType(2.1),
    awaitingMerge: byType((9 * MINUTE_MS) / HOUR_MS),
  },
};

export const SHIPPING: InsightsShipping = {
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
