import {
  type ByPercentile,
  between,
  byPercentile,
  type Percentile,
  type Percentiles,
  rateOf,
} from '@insights/domain/services/measures';
import type { StationLocation } from '@insights/domain/services/station-ranking';
import {
  ROUND_BUCKETS,
  type RoundBucket,
} from '@insights/domain/services/team-pull-requests';
import { type Delta, deltaOf } from '@insights/domain/value-objects/delta.vo';
import { type PullRequestType } from '@insights/domain/value-objects/pull-request-type';
import type { BotActivity } from '@insights/domain/value-objects/seen-pull-request.vo';

export const ROLLING_DAYS = 7;

export interface ByAuthor {
  readonly spotlight: Percentiles;
  readonly people: Percentiles;
}

interface PercentileDeltas {
  readonly p50: Delta | null;
  readonly p75: Delta | null;
  readonly p90: Delta | null;
  readonly p95: Delta | null;
}

export interface ByAuthorDeltas {
  readonly spotlight: PercentileDeltas;
  readonly people: PercentileDeltas;
}

export interface MergeDay {
  readonly day: string;
  readonly daily: ByAuthor;
  readonly rolling: ByAuthor;
}

export interface TypeMerge {
  readonly type: PullRequestType;
  readonly merged: number;
  readonly toMerge: ByAuthor;
}

interface RoundsMerged {
  readonly rounds: RoundBucket;
  readonly merged: number;
}

export interface RoundsCount extends RoundsMerged {
  readonly rate: number | null;
}

export interface DepthWeekCounts {
  readonly week: string;
  readonly merged: number;
  readonly rounds: readonly RoundsMerged[];
}

interface DepthWeek extends DepthWeekCounts {
  readonly rounds: readonly RoundsCount[];
}

export interface ReviewDay {
  readonly day: string;
  readonly toFirstReview: {
    readonly daily: Percentiles;
    readonly rolling: Percentiles;
  };
  readonly awaiting: number;
  readonly humanReviews: number;
}

interface ReviewBot {
  readonly login: string;
  readonly comments: number;
  readonly reviews: number;
  readonly resolvedRate: number | null;
}

export const STATION_STAGES = ['queued', 'running', 'inbox'] as const;

export type StationStage = (typeof STATION_STAGES)[number];

type StageParts = Readonly<Record<StationStage, Percentiles>>;

export interface Timed {
  readonly total: Percentiles;
  readonly parts: StageParts | null;
}

export interface StageTimes extends Timed {
  readonly bottleneckRatio: ByPercentile<number>;
  readonly worst: ByPercentile<boolean>;
  readonly longestPart: ByPercentile<StationStage | null> | null;
}

interface Typed<T> {
  readonly all: T;
  readonly types: readonly {
    readonly type: PullRequestType;
    readonly times: T;
  }[];
}

export type ByType = Typed<StageTimes>;

export const FLOW_STAGE_KINDS = [
  'coding',
  'station',
  'awaitingReview',
  'inReview',
  'awaitingMerge',
] as const;

export type FlowStageKind = (typeof FLOW_STAGE_KINDS)[number];

export interface Stage<T> {
  readonly kind: FlowStageKind;
  readonly location: StationLocation | null;
  readonly times: Typed<T>;
}

export type FlowStage = Stage<StageTimes>;

const FLOW_LAYOUTS = ['stations', 'stages'] as const;

export type FlowLayout = (typeof FLOW_LAYOUTS)[number];

interface TypeCount {
  readonly type: PullRequestType;
  readonly merged: number;
}

export interface ShippedPipeline {
  readonly merged: number;
  readonly types: readonly TypeCount[];
  readonly coding: Stage<Timed>;
  readonly stations: readonly Stage<Timed>[];
  readonly review: readonly Stage<Timed>[];
}

export interface ShippingCounts {
  readonly toMerge: ByAuthor;
  readonly toMergeBefore: ByAuthor;
  readonly mergeDays: readonly MergeDay[];
  readonly types: readonly TypeMerge[];
  readonly depth: readonly DepthWeekCounts[];
  readonly reviewDays: readonly ReviewDay[];
  readonly bots: readonly BotActivity[];
  readonly pipeline: ShippedPipeline;
}

interface PipelineFlow {
  readonly merged: number;
  readonly types: readonly TypeCount[];
  readonly layouts: Readonly<Record<FlowLayout, readonly FlowStage[]>>;
}

export interface Shipping {
  readonly toMerge: ByAuthor;
  readonly toMergeChanges: ByAuthorDeltas;
  readonly mergeDays: readonly MergeDay[];
  readonly types: readonly TypeMerge[];
  readonly slowestFirst: ByPercentile<readonly PullRequestType[]>;
  readonly depth: readonly DepthWeek[];
  readonly depthTotals: readonly RoundsCount[];
  readonly reviewDays: readonly ReviewDay[];
  readonly bots: readonly ReviewBot[];
  readonly pipeline: PipelineFlow;
  readonly shippedAny: boolean;
}

const fallingIsBetter = { better: 'down', unit: 'percent' } as const;

const percentileChangesOf = (
  now: Percentiles,
  before: Percentiles,
): PercentileDeltas => ({
  p50: deltaOf(now.p50, before.p50, fallingIsBetter),
  p75: deltaOf(now.p75, before.p75, fallingIsBetter),
  p90: deltaOf(now.p90, before.p90, fallingIsBetter),
  p95: deltaOf(now.p95, before.p95, fallingIsBetter),
});

const byAuthorChangesOf = (
  now: ByAuthor,
  before: ByAuthor,
): ByAuthorDeltas => ({
  spotlight: percentileChangesOf(now.spotlight, before.spotlight),
  people: percentileChangesOf(now.people, before.people),
});

const _lasted = (from: Date | null, to: Date | null): number | null =>
  from && to ? Math.max(0, between(from, to)) : null;

const slowerFirst = (one: number | null, other: number | null): number =>
  one === null || other === null
    ? Number(one === null) - Number(other === null)
    : other - one;

const slowestFirstOf = (
  types: readonly TypeMerge[],
): ByPercentile<readonly PullRequestType[]> =>
  byPercentile((percentile) =>
    [...types]
      .sort((one, other) =>
        slowerFirst(
          one.toMerge.spotlight[percentile],
          other.toMerge.spotlight[percentile],
        ),
      )
      .map((each) => each.type),
  );

const roundsCountsOf = (
  counted: (rounds: RoundBucket) => number,
): readonly RoundsCount[] => {
  const merged = ROUND_BUCKETS.map(counted);
  const all = merged.reduce((sum, each) => sum + each, 0);

  return ROUND_BUCKETS.map((rounds, at) => ({
    rounds,
    merged: merged[at] ?? 0,
    rate: rateOf(merged[at] ?? 0, all),
  }));
};

const mergedIn = (rounds: RoundBucket, week: DepthWeekCounts): number =>
  week.rounds.find((each) => each.rounds === rounds)?.merged ?? 0;

const depthFrom = (weeks: readonly DepthWeekCounts[]): readonly DepthWeek[] =>
  weeks.map((week) => ({
    ...week,
    rounds: roundsCountsOf((rounds) => mergedIn(rounds, week)),
  }));

const depthTotalsOf = (
  weeks: readonly DepthWeekCounts[],
): readonly RoundsCount[] =>
  roundsCountsOf((rounds) =>
    weeks.reduce((sum, week) => sum + mergedIn(rounds, week), 0),
  );

const botsFrom = (sums: readonly BotActivity[]): readonly ReviewBot[] =>
  [...sums]
    .map((each) => ({
      login: each.login,
      comments: each.comments,
      reviews: each.reviews,
      resolvedRate:
        each.threads > 0 ? each.resolvedThreads / each.threads : null,
    }))
    .sort((one, other) => other.comments - one.comments);

const timedFor = (
  stage: Stage<Timed>,
  type: PullRequestType | null,
): Timed | null =>
  type
    ? (stage.times.types.find((each) => each.type === type)?.times ?? null)
    : stage.times.all;

const worstOf = (lasted: readonly (number | null)[]): number =>
  lasted.reduce<number>(
    (worst, each, at) =>
      each !== null && (lasted[worst] ?? -1) < each ? at : worst,
    -1,
  );

const longestPartOf = (
  parts: StageParts | null,
): ByPercentile<StationStage | null> | null =>
  parts
    ? byPercentile((percentile) =>
        STATION_STAGES.reduce<StationStage | null>(
          (longest, part) =>
            (parts[part][percentile] ?? 0) >
            (longest ? (parts[longest][percentile] ?? 0) : 0)
              ? part
              : longest,
          null,
        ),
      )
    : null;

const withBottleneckRatios = (
  stages: readonly Stage<Timed>[],
): readonly FlowStage[] => {
  const judged = (
    times: Timed,
    at: number,
    type: PullRequestType | null,
  ): StageTimes => {
    const lastedAt = (percentile: Percentile): (number | null)[] =>
      stages.map((stage) => timedFor(stage, type)?.total[percentile] ?? null);

    return {
      ...times,
      bottleneckRatio: byPercentile((percentile) => {
        const lasted = lastedAt(percentile);
        const max = Math.max(0, ...lasted.map((each) => each ?? 0));

        return max === 0 ? 0 : (lasted[at] ?? 0) / max;
      }),
      worst: byPercentile((percentile) => worstOf(lastedAt(percentile)) === at),
      longestPart: longestPartOf(times.parts),
    };
  };

  return stages.map((stage, at) => ({
    kind: stage.kind,
    location: stage.location,
    times: {
      all: judged(stage.times.all, at, null),
      types: stage.times.types.map((each) => ({
        type: each.type,
        times: judged(each.times, at, each.type),
      })),
    },
  }));
};

const pipelineFrom = (shipped: ShippedPipeline): PipelineFlow => ({
  merged: shipped.merged,
  types: shipped.types,
  layouts: {
    stations: withBottleneckRatios([...shipped.stations, ...shipped.review]),
    stages: withBottleneckRatios([shipped.coding, ...shipped.review]),
  },
});

export const shippingFrom = (counts: ShippingCounts): Shipping => {
  const pipeline = pipelineFrom(counts.pipeline);
  const depth = depthFrom(counts.depth);

  return {
    toMerge: counts.toMerge,
    toMergeChanges: byAuthorChangesOf(counts.toMerge, counts.toMergeBefore),
    mergeDays: counts.mergeDays,
    types: counts.types,
    slowestFirst: slowestFirstOf(counts.types),
    depth,
    depthTotals: depthTotalsOf(counts.depth),
    reviewDays: counts.reviewDays,
    bots: botsFrom(counts.bots),
    pipeline,
    shippedAny:
      pipeline.merged > 0 ||
      counts.types.length > 0 ||
      counts.reviewDays.some(
        (each) => each.awaiting > 0 || each.humanReviews > 0,
      ),
  };
};
