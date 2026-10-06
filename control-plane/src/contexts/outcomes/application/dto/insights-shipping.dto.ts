import type { PeriodDto } from '@outcomes/application/dto/insights.dto';
import type { Percentiles } from '@outcomes/domain/services/measures';
import type {
  ByAuthor,
  ByType,
  Shipping,
  StageTimes,
} from '@outcomes/domain/services/shipping';
import type { RoundBucket } from '@outcomes/domain/services/team-pull-requests';
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

export interface StagePartsDto {
  readonly queued: PercentilesDto;
  readonly running: PercentilesDto;
  readonly inbox: PercentilesDto;
}

export interface StageTimesDto {
  readonly total: PercentilesDto;
  readonly parts: StagePartsDto | null;
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

export interface DepthWeekDto {
  readonly week: string;
  readonly merged: number;
  readonly rounds: readonly {
    readonly rounds: RoundBucket;
    readonly merged: number;
  }[];
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

export interface StationStageDto {
  readonly lineId: string;
  readonly stationId: string;
  readonly times: ByTypeDto;
}

export interface PipelineFlowDto {
  readonly merged: number;
  readonly types: readonly {
    readonly type: PullRequestType;
    readonly merged: number;
  }[];
  readonly coding: ByTypeDto;
  readonly stations: readonly StationStageDto[];
  readonly awaitingReview: ByTypeDto;
  readonly inReview: ByTypeDto;
  readonly awaitingMerge: ByTypeDto;
}

export interface InsightsShippingDto {
  readonly period: PeriodDto;
  readonly truncated: boolean;
  readonly toMerge: ByAuthorDto;
  readonly toMergeBefore: ByAuthorDto;
  readonly mergeDays: readonly MergeDayDto[];
  readonly types: readonly TypeMergeDto[];
  readonly depth: readonly DepthWeekDto[];
  readonly reviewDays: readonly ReviewDayDto[];
  readonly bots: readonly ReviewBotDto[];
  readonly pipeline: PipelineFlowDto;
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
});

const byTypeDtoOf = (byType: ByType): ByTypeDto => ({
  all: stageTimesDtoOf(byType.all),
  types: byType.types.map((each) => ({
    type: each.type,
    times: stageTimesDtoOf(each.times),
  })),
});

export const shippingDtoOf = (
  shipping: Shipping,
): Omit<InsightsShippingDto, 'period' | 'truncated'> => ({
  toMerge: byAuthorDtoOf(shipping.toMerge),
  toMergeBefore: byAuthorDtoOf(shipping.toMergeBefore),
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
  depth: shipping.depth.map((each) => ({
    week: each.week,
    merged: each.merged,
    rounds: Object.entries(each.rounds).map(([rounds, merged]) => ({
      rounds: rounds as RoundBucket,
      merged,
    })),
  })),
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
    coding: byTypeDtoOf(shipping.pipeline.coding),
    stations: shipping.pipeline.stations.map((each) => ({
      lineId: each.lineId,
      stationId: each.stationId,
      times: byTypeDtoOf(each.times),
    })),
    awaitingReview: byTypeDtoOf(shipping.pipeline.review.awaitingReview),
    inReview: byTypeDtoOf(shipping.pipeline.review.inReview),
    awaitingMerge: byTypeDtoOf(shipping.pipeline.review.awaitingMerge),
  },
});
