import type { PeriodDto } from '@outcomes/application/dto/insights.dto';
import type {
  ByPercentile,
  Percentiles,
} from '@outcomes/domain/services/measures';
import type {
  ByAuthor,
  ByAuthorChanges,
  ByType,
  FlowLayout,
  FlowStage,
  FlowStageKind,
  RoundsCount,
  Shipping,
  StageTimes,
  StationPart,
} from '@outcomes/domain/services/shipping';
import type { PullRequestType } from '@outcomes/domain/value-objects/pull-request-type';

export interface PercentilesDto {
  readonly p50Ms: number | null;
  readonly p75Ms: number | null;
  readonly p90Ms: number | null;
  readonly p95Ms: number | null;
  readonly count: number;
}

export interface ByAuthorDto {
  readonly spotlight: PercentilesDto;
  readonly people: PercentilesDto;
}

export type ByAuthorChangesDto = ByAuthorChanges;

export interface StagePartsDto {
  readonly queued: PercentilesDto;
  readonly running: PercentilesDto;
  readonly inbox: PercentilesDto;
}

export interface StageTimesDto {
  readonly total: PercentilesDto;
  readonly parts: StagePartsDto | null;
  readonly jam: ByPercentile<number>;
  readonly worst: ByPercentile<boolean>;
  readonly longestPart: ByPercentile<StationPart | null> | null;
}

export interface TypedStageTimesDto {
  readonly type: PullRequestType;
  readonly times: StageTimesDto;
}

export interface ByTypeDto {
  readonly all: StageTimesDto;
  readonly types: readonly TypedStageTimesDto[];
}

export interface MergeDayDto {
  readonly day: string;
  readonly daily: ByAuthorDto;
  readonly rolling: ByAuthorDto;
}

export interface TypeMergeDto {
  readonly type: PullRequestType;
  readonly merged: number;
  readonly toMerge: ByAuthorDto;
}

export type RoundsCountDto = RoundsCount;

export interface DepthWeekDto {
  readonly week: string;
  readonly merged: number;
  readonly rounds: readonly RoundsCountDto[];
}

export interface ReviewDayDto {
  readonly day: string;
  readonly toFirstReviewDaily: PercentilesDto;
  readonly toFirstReviewRolling: PercentilesDto;
  readonly awaiting: number;
  readonly humanReviews: number;
}

export interface ReviewBotDto {
  readonly login: string;
  readonly comments: number;
  readonly reviews: number;
  readonly resolvedShare: number | null;
}

export interface FlowStageDto {
  readonly kind: FlowStageKind;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly times: ByTypeDto;
}

export interface PipelineFlowDto {
  readonly merged: number;
  readonly types: readonly {
    readonly type: PullRequestType;
    readonly merged: number;
  }[];
  readonly layouts: Readonly<Record<FlowLayout, readonly FlowStageDto[]>>;
}

export interface InsightsShippingDto {
  readonly period: PeriodDto;
  readonly toMerge: ByAuthorDto;
  readonly toMergeChanges: ByAuthorChangesDto;
  readonly mergeDays: readonly MergeDayDto[];
  readonly types: readonly TypeMergeDto[];
  readonly slowestFirst: ByPercentile<readonly PullRequestType[]>;
  readonly depth: readonly DepthWeekDto[];
  readonly depthTotals: readonly RoundsCountDto[];
  readonly reviewDays: readonly ReviewDayDto[];
  readonly bots: readonly ReviewBotDto[];
  readonly pipeline: PipelineFlowDto;
  readonly shippedAny: boolean;
}

const percentilesDtoOf = (percentiles: Percentiles): PercentilesDto => ({
  p50Ms: percentiles.p50,
  p75Ms: percentiles.p75,
  p90Ms: percentiles.p90,
  p95Ms: percentiles.p95,
  count: percentiles.count,
});

const byAuthorDtoOf = (byAuthor: ByAuthor): ByAuthorDto => ({
  spotlight: percentilesDtoOf(byAuthor.spotlight),
  people: percentilesDtoOf(byAuthor.people),
});

const stageTimesDtoOf = (times: StageTimes): StageTimesDto => ({
  total: percentilesDtoOf(times.total),
  parts: times.parts
    ? {
        queued: percentilesDtoOf(times.parts.queued),
        running: percentilesDtoOf(times.parts.running),
        inbox: percentilesDtoOf(times.parts.inbox),
      }
    : null,
  jam: times.jam,
  worst: times.worst,
  longestPart: times.longestPart,
});

const byTypeDtoOf = (byType: ByType): ByTypeDto => ({
  all: stageTimesDtoOf(byType.all),
  types: byType.types.map((each) => ({
    type: each.type,
    times: stageTimesDtoOf(each.times),
  })),
});

const flowStageDtoOf = (stage: FlowStage): FlowStageDto => ({
  kind: stage.kind,
  lineId: stage.place?.lineId ?? null,
  stationId: stage.place?.stationId ?? null,
  times: byTypeDtoOf(stage.times),
});

export const shippingDtoOf = (
  shipping: Shipping,
): Omit<InsightsShippingDto, 'period'> => ({
  toMerge: byAuthorDtoOf(shipping.toMerge),
  toMergeChanges: shipping.toMergeChanges,
  mergeDays: shipping.mergeDays.map((each) => ({
    day: each.day,
    daily: byAuthorDtoOf(each.daily),
    rolling: byAuthorDtoOf(each.rolling),
  })),
  types: shipping.types.map((each) => ({
    type: each.type,
    merged: each.merged,
    toMerge: byAuthorDtoOf(each.toMerge),
  })),
  slowestFirst: shipping.slowestFirst,
  depth: shipping.depth,
  depthTotals: shipping.depthTotals,
  reviewDays: shipping.reviewDays.map((each) => ({
    day: each.day,
    toFirstReviewDaily: percentilesDtoOf(each.toFirstReview.daily),
    toFirstReviewRolling: percentilesDtoOf(each.toFirstReview.rolling),
    awaiting: each.awaiting,
    humanReviews: each.humanReviews,
  })),
  bots: shipping.bots,
  pipeline: {
    merged: shipping.pipeline.merged,
    types: shipping.pipeline.types,
    layouts: {
      stations: shipping.pipeline.layouts.stations.map(flowStageDtoOf),
      stages: shipping.pipeline.layouts.stages.map(flowStageDtoOf),
    },
  },
  shippedAny: shipping.shippedAny,
});
