import type {
  ByAuthorDeltasDto,
  ByAuthorDto,
  ByTypeDto,
  DepthWeekDto,
  FlowStageDto,
  InsightsShippingDto,
  MergeDayDto,
  PercentilesDto,
  PipelineFlowDto,
  ReviewBotDto,
  ReviewDayDto,
  RoundsCountDto,
  StagePartsDto,
  StageTimesDto,
  TypedStageTimesDto,
  TypeMergeDto,
} from '@insights/application/dto/insights-shipping.dto';
import type { ByPercentile } from '@insights/domain/services/measures';
import {
  FLOW_STAGE_KINDS,
  STATION_STAGES,
} from '@insights/domain/services/shipping';
import { ROUND_BUCKETS } from '@insights/domain/services/team-pull-requests';
import { PULL_REQUEST_TYPES } from '@insights/domain/value-objects/pull-request-type';
import {
  DeltaResponseDto,
  deltaResponseOf,
  InsightsPeriodResponseDto,
} from '@insights/presentation/http/dto/insights-common.response.dto';
import { ApiProperty } from '@nestjs/swagger';

const millis = (description: string, example: number) =>
  ApiProperty({ nullable: true, type: Number, example, description });

export class PercentilesResponseDto {
  @millis(
    'The median, in milliseconds; none when nothing was measured',
    3_600_000,
  )
  readonly p50Ms: number | null;

  @millis('What three in four stayed within, in milliseconds', 7_200_000)
  readonly p75Ms: number | null;

  @millis('What nine in ten stayed within, in milliseconds', 14_400_000)
  readonly p90Ms: number | null;

  @millis('What nineteen in twenty stayed within, in milliseconds', 21_600_000)
  readonly p95Ms: number | null;

  @ApiProperty({ example: 14, description: 'How many were measured' })
  readonly count: number;

  constructor(percentiles: PercentilesDto) {
    this.p50Ms = percentiles.p50Ms;
    this.p75Ms = percentiles.p75Ms;
    this.p90Ms = percentiles.p90Ms;
    this.p95Ms = percentiles.p95Ms;
    this.count = percentiles.count;
  }
}

export class ByAuthorResponseDto {
  @ApiProperty({
    type: PercentilesResponseDto,
    description: 'Pull requests Spotlight made',
  })
  readonly spotlight: PercentilesResponseDto;

  @ApiProperty({
    type: PercentilesResponseDto,
    description:
      'Pull requests people made alone, in the repositories Spotlight merged into',
  })
  readonly people: PercentilesResponseDto;

  constructor(byAuthor: ByAuthorDto) {
    this.spotlight = new PercentilesResponseDto(byAuthor.spotlight);
    this.people = new PercentilesResponseDto(byAuthor.people);
  }
}

export class MergeDayResponseDto {
  @ApiProperty({ example: '2026-10-01', description: 'The UTC day' })
  readonly day: string;

  @ApiProperty({
    type: ByAuthorResponseDto,
    description: 'Opened to merged, for pull requests merged that day',
  })
  readonly daily: ByAuthorResponseDto;

  @ApiProperty({
    type: ByAuthorResponseDto,
    description:
      'Opened to merged, for pull requests merged in the 7 days ending that day',
  })
  readonly rolling: ByAuthorResponseDto;

  constructor(day: MergeDayDto) {
    this.day = day.day;
    this.daily = new ByAuthorResponseDto(day.daily);
    this.rolling = new ByAuthorResponseDto(day.rolling);
  }
}

export class TypeMergeResponseDto {
  @ApiProperty({ enum: PULL_REQUEST_TYPES, example: 'feature' })
  readonly type: string;

  @ApiProperty({
    example: 31,
    description: 'Merged in the period, Spotlight’s and people’s alone',
  })
  readonly merged: number;

  @ApiProperty({ type: ByAuthorResponseDto, description: 'Opened to merged' })
  readonly toMerge: ByAuthorResponseDto;

  constructor(type: TypeMergeDto) {
    this.type = type.type;
    this.merged = type.merged;
    this.toMerge = new ByAuthorResponseDto(type.toMerge);
  }
}

export class RoundsCountResponseDto {
  @ApiProperty({ enum: ROUND_BUCKETS, example: '1' })
  readonly rounds: string;

  @ApiProperty({ example: 15, description: 'Merged with that many rounds' })
  readonly merged: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.52,
    description:
      'Those over everything merged across the buckets, from 0 to 1; none where nothing merged',
  })
  readonly rate: number | null;

  constructor(rounds: RoundsCountDto) {
    this.rounds = rounds.rounds;
    this.merged = rounds.merged;
    this.rate = rounds.rate;
  }
}

export class DepthWeekResponseDto {
  @ApiProperty({
    example: '2026-09-28',
    description: 'The Monday, UTC, the week starts on',
  })
  readonly week: string;

  @ApiProperty({ example: 29, description: 'Merged that week' })
  readonly merged: number;

  @ApiProperty({
    type: RoundsCountResponseDto,
    isArray: true,
    description: 'How many of them needed each number of review rounds',
  })
  readonly rounds: readonly RoundsCountResponseDto[];

  constructor(week: DepthWeekDto) {
    this.week = week.week;
    this.merged = week.merged;
    this.rounds = week.rounds.map((each) => new RoundsCountResponseDto(each));
  }
}

export class ReviewDayResponseDto {
  @ApiProperty({ example: '2026-10-01', description: 'The UTC day' })
  readonly day: string;

  @ApiProperty({
    type: PercentilesResponseDto,
    description:
      'Ready for review to the first review by anyone but the author, bots’ included, for pull requests first reviewed that day',
  })
  readonly toFirstReviewDaily: PercentilesResponseDto;

  @ApiProperty({
    type: PercentilesResponseDto,
    description: 'The same over the 7 days ending that day',
  })
  readonly toFirstReviewRolling: PercentilesResponseDto;

  @ApiProperty({
    example: 6,
    description:
      'Pull requests ready and not yet reviewed at the end of the day',
  })
  readonly awaiting: number;

  @ApiProperty({
    example: 11,
    description: 'Reviews people submitted that day',
  })
  readonly humanReviews: number;

  constructor(day: ReviewDayDto) {
    this.day = day.day;
    this.toFirstReviewDaily = new PercentilesResponseDto(
      day.toFirstReviewDaily,
    );
    this.toFirstReviewRolling = new PercentilesResponseDto(
      day.toFirstReviewRolling,
    );
    this.awaiting = day.awaiting;
    this.humanReviews = day.humanReviews;
  }
}

export class ReviewBotResponseDto {
  @ApiProperty({ example: 'coderabbitai[bot]' })
  readonly login: string;

  @ApiProperty({
    example: 120,
    description:
      'Comments it left on pull requests active in the period, inline and in the conversation',
  })
  readonly comments: number;

  @ApiProperty({ example: 40, description: 'Reviews it submitted' })
  readonly reviews: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.42,
    description:
      'Of the review threads it started, the fraction now resolved, from 0 to 1; none where it started none',
  })
  readonly resolvedRate: number | null;

  constructor(bot: ReviewBotDto) {
    this.login = bot.login;
    this.comments = bot.comments;
    this.reviews = bot.reviews;
    this.resolvedRate = bot.resolvedRate;
  }
}

export class StagePartsResponseDto {
  @ApiProperty({ type: PercentilesResponseDto })
  readonly queued: PercentilesResponseDto;

  @ApiProperty({ type: PercentilesResponseDto })
  readonly running: PercentilesResponseDto;

  @ApiProperty({ type: PercentilesResponseDto })
  readonly inbox: PercentilesResponseDto;

  constructor(parts: StagePartsDto) {
    this.queued = new PercentilesResponseDto(parts.queued);
    this.running = new PercentilesResponseDto(parts.running);
    this.inbox = new PercentilesResponseDto(parts.inbox);
  }
}

export class PercentileBottleneckRatiosResponseDto {
  @ApiProperty({ example: 0.4 })
  readonly p50: number;

  @ApiProperty({ example: 0.6 })
  readonly p75: number;

  @ApiProperty({ example: 1 })
  readonly p90: number;

  @ApiProperty({ example: 0.8 })
  readonly p95: number;

  constructor(bottleneckRatios: ByPercentile<number>) {
    this.p50 = bottleneckRatios.p50;
    this.p75 = bottleneckRatios.p75;
    this.p90 = bottleneckRatios.p90;
    this.p95 = bottleneckRatios.p95;
  }
}

export class PercentileWorstResponseDto {
  @ApiProperty({ example: false })
  readonly p50: boolean;

  @ApiProperty({ example: true })
  readonly p75: boolean;

  @ApiProperty({ example: true })
  readonly p90: boolean;

  @ApiProperty({ example: false })
  readonly p95: boolean;

  constructor(worst: ByPercentile<boolean>) {
    this.p50 = worst.p50;
    this.p75 = worst.p75;
    this.p90 = worst.p90;
    this.p95 = worst.p95;
  }
}

export class PercentilePartsResponseDto {
  @ApiProperty({
    enum: [...STATION_STAGES, null],
    nullable: true,
    example: 'running',
  })
  readonly p50: string | null;

  @ApiProperty({
    enum: [...STATION_STAGES, null],
    nullable: true,
    example: 'running',
  })
  readonly p75: string | null;

  @ApiProperty({
    enum: [...STATION_STAGES, null],
    nullable: true,
    example: 'inbox',
  })
  readonly p90: string | null;

  @ApiProperty({
    enum: [...STATION_STAGES, null],
    nullable: true,
    example: 'inbox',
  })
  readonly p95: string | null;

  constructor(parts: ByPercentile<string | null>) {
    this.p50 = parts.p50;
    this.p75 = parts.p75;
    this.p90 = parts.p90;
    this.p95 = parts.p95;
  }
}

export class StageTimesResponseDto {
  @ApiProperty({ type: PercentilesResponseDto })
  readonly total: PercentilesResponseDto;

  @ApiProperty({
    type: StagePartsResponseDto,
    nullable: true,
    description: 'At a station, the time queued, running and in the inbox',
  })
  readonly parts: StagePartsResponseDto | null;

  @ApiProperty({
    type: PercentileBottleneckRatiosResponseDto,
    description:
      'At each percentile, the stage’s time over the longest stage’s in the same layout and for the same kind of pull request, from 0 to 1',
  })
  readonly bottleneckRatio: PercentileBottleneckRatiosResponseDto;

  @ApiProperty({
    type: PercentileWorstResponseDto,
    description:
      'At each percentile, whether this is the longest stage in the layout for the same kind of pull request; the first one on a tie',
  })
  readonly worst: PercentileWorstResponseDto;

  @ApiProperty({
    type: PercentilePartsResponseDto,
    nullable: true,
    description:
      'At a station, the part that took longest at each percentile; queued first on a tie, none where no part took any time',
  })
  readonly longestPart: PercentilePartsResponseDto | null;

  constructor(times: StageTimesDto) {
    this.total = new PercentilesResponseDto(times.total);
    this.parts = times.parts ? new StagePartsResponseDto(times.parts) : null;
    this.bottleneckRatio = new PercentileBottleneckRatiosResponseDto(
      times.bottleneckRatio,
    );
    this.worst = new PercentileWorstResponseDto(times.worst);
    this.longestPart = times.longestPart
      ? new PercentilePartsResponseDto(times.longestPart)
      : null;
  }
}

export class TypedStageTimesResponseDto {
  @ApiProperty({ enum: PULL_REQUEST_TYPES, example: 'fix' })
  readonly type: string;

  @ApiProperty({ type: StageTimesResponseDto })
  readonly times: StageTimesResponseDto;

  constructor(typed: TypedStageTimesDto) {
    this.type = typed.type;
    this.times = new StageTimesResponseDto(typed.times);
  }
}

export class ByTypeResponseDto {
  @ApiProperty({ type: StageTimesResponseDto })
  readonly all: StageTimesResponseDto;

  @ApiProperty({
    type: TypedStageTimesResponseDto,
    isArray: true,
    description: 'The same, for each kind of pull request that went through it',
  })
  readonly types: readonly TypedStageTimesResponseDto[];

  constructor(byType: ByTypeDto) {
    this.all = new StageTimesResponseDto(byType.all);
    this.types = byType.types.map(
      (each) => new TypedStageTimesResponseDto(each),
    );
  }
}

export class FlowStageResponseDto {
  @ApiProperty({
    enum: FLOW_STAGE_KINDS,
    example: 'station',
    description:
      'Coding: task opened to pull request opened. Station: time the task spent at one station. Awaiting review: ready for review to the first review by anyone but the author, bots’ included. In review: first review to approval, or to merge where none approved. Awaiting merge: approval to merge',
  })
  readonly kind: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'line_delivery',
    description: 'The station’s line; none for other stages',
  })
  readonly lineId: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'station_implementation',
    description: 'The station; none for other stages',
  })
  readonly stationId: string | null;

  @ApiProperty({ type: ByTypeResponseDto })
  readonly times: ByTypeResponseDto;

  constructor(stage: FlowStageDto) {
    this.kind = stage.kind;
    this.lineId = stage.lineId;
    this.stationId = stage.stationId;
    this.times = new ByTypeResponseDto(stage.times);
  }
}

export class FlowLayoutsResponseDto {
  @ApiProperty({
    type: FlowStageResponseDto,
    isArray: true,
    description:
      'Coding as each station the tasks went through, in order of first use, then the review stages',
  })
  readonly stations: readonly FlowStageResponseDto[];

  @ApiProperty({
    type: FlowStageResponseDto,
    isArray: true,
    description: 'Coding as one stage, then the review stages',
  })
  readonly stages: readonly FlowStageResponseDto[];

  constructor(layouts: PipelineFlowDto['layouts']) {
    this.stations = layouts.stations.map(
      (each) => new FlowStageResponseDto(each),
    );
    this.stages = layouts.stages.map((each) => new FlowStageResponseDto(each));
  }
}

export class PipelineTypeResponseDto {
  @ApiProperty({ enum: PULL_REQUEST_TYPES, example: 'feature' })
  readonly type: string;

  @ApiProperty({ example: 12 })
  readonly merged: number;

  constructor(type: PipelineFlowDto['types'][number]) {
    this.type = type.type;
    this.merged = type.merged;
  }
}

export class PipelineFlowResponseDto {
  @ApiProperty({
    example: 95,
    description: 'Spotlight’s pull requests merged in the period',
  })
  readonly merged: number;

  @ApiProperty({ type: PipelineTypeResponseDto, isArray: true })
  readonly types: readonly PipelineTypeResponseDto[];

  @ApiProperty({
    type: FlowLayoutsResponseDto,
    description:
      'The stages in order, with coding shown by station or as one stage',
  })
  readonly layouts: FlowLayoutsResponseDto;

  constructor(pipeline: PipelineFlowDto) {
    this.merged = pipeline.merged;
    this.types = pipeline.types.map(
      (each) => new PipelineTypeResponseDto(each),
    );
    this.layouts = new FlowLayoutsResponseDto(pipeline.layouts);
  }
}

export class PercentileDeltasResponseDto {
  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description: 'The median against the period before',
  })
  readonly p50: DeltaResponseDto | null;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description: 'The 75th percentile against the period before',
  })
  readonly p75: DeltaResponseDto | null;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description: 'The 90th percentile against the period before',
  })
  readonly p90: DeltaResponseDto | null;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description: 'The 95th percentile against the period before',
  })
  readonly p95: DeltaResponseDto | null;

  constructor(changes: ByAuthorDeltasDto['spotlight']) {
    this.p50 = deltaResponseOf(changes.p50);
    this.p75 = deltaResponseOf(changes.p75);
    this.p90 = deltaResponseOf(changes.p90);
    this.p95 = deltaResponseOf(changes.p95);
  }
}

export class ByAuthorChangesResponseDto {
  @ApiProperty({
    type: PercentileDeltasResponseDto,
    description: 'Pull requests Spotlight made',
  })
  readonly spotlight: PercentileDeltasResponseDto;

  @ApiProperty({
    type: PercentileDeltasResponseDto,
    description:
      'Pull requests people made alone, in the repositories Spotlight merged into',
  })
  readonly people: PercentileDeltasResponseDto;

  constructor(changes: ByAuthorDeltasDto) {
    this.spotlight = new PercentileDeltasResponseDto(changes.spotlight);
    this.people = new PercentileDeltasResponseDto(changes.people);
  }
}

export class PercentileTypesResponseDto {
  @ApiProperty({ enum: PULL_REQUEST_TYPES, isArray: true })
  readonly p50: readonly string[];

  @ApiProperty({ enum: PULL_REQUEST_TYPES, isArray: true })
  readonly p75: readonly string[];

  @ApiProperty({ enum: PULL_REQUEST_TYPES, isArray: true })
  readonly p90: readonly string[];

  @ApiProperty({ enum: PULL_REQUEST_TYPES, isArray: true })
  readonly p95: readonly string[];

  constructor(types: ByPercentile<readonly string[]>) {
    this.p50 = types.p50;
    this.p75 = types.p75;
    this.p90 = types.p90;
    this.p95 = types.p95;
  }
}

export class InsightsShippingResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({
    type: ByAuthorResponseDto,
    description: 'Opened to merged, for pull requests merged in the period',
  })
  readonly toMerge: ByAuthorResponseDto;

  @ApiProperty({
    type: ByAuthorChangesResponseDto,
    description:
      'Opened to merged at each percentile against the period before, as long',
  })
  readonly toMergeChanges: ByAuthorChangesResponseDto;

  @ApiProperty({ type: MergeDayResponseDto, isArray: true })
  readonly mergeDays: readonly MergeDayResponseDto[];

  @ApiProperty({ type: TypeMergeResponseDto, isArray: true })
  readonly types: readonly TypeMergeResponseDto[];

  @ApiProperty({
    type: PercentileTypesResponseDto,
    description:
      'At each percentile, the kinds in types by Spotlight’s opened to merged, slowest first; unmeasured last',
  })
  readonly slowestFirst: PercentileTypesResponseDto;

  @ApiProperty({ type: DepthWeekResponseDto, isArray: true })
  readonly depth: readonly DepthWeekResponseDto[];

  @ApiProperty({
    type: RoundsCountResponseDto,
    isArray: true,
    description: 'The weeks in depth summed, for each number of review rounds',
  })
  readonly depthTotals: readonly RoundsCountResponseDto[];

  @ApiProperty({ type: ReviewDayResponseDto, isArray: true })
  readonly reviewDays: readonly ReviewDayResponseDto[];

  @ApiProperty({
    type: ReviewBotResponseDto,
    isArray: true,
    description: 'The most comments first',
  })
  readonly bots: readonly ReviewBotResponseDto[];

  @ApiProperty({ type: PipelineFlowResponseDto })
  readonly pipeline: PipelineFlowResponseDto;

  @ApiProperty({
    example: true,
    description:
      'Whether anything merged, waited on a review or was reviewed by a person over the period',
  })
  readonly shippedAny: boolean;

  constructor(shipping: InsightsShippingDto) {
    this.period = new InsightsPeriodResponseDto(shipping.period);
    this.toMerge = new ByAuthorResponseDto(shipping.toMerge);
    this.toMergeChanges = new ByAuthorChangesResponseDto(
      shipping.toMergeChanges,
    );
    this.mergeDays = shipping.mergeDays.map(
      (each) => new MergeDayResponseDto(each),
    );
    this.types = shipping.types.map((each) => new TypeMergeResponseDto(each));
    this.slowestFirst = new PercentileTypesResponseDto(shipping.slowestFirst);
    this.depth = shipping.depth.map((each) => new DepthWeekResponseDto(each));
    this.depthTotals = shipping.depthTotals.map(
      (each) => new RoundsCountResponseDto(each),
    );
    this.reviewDays = shipping.reviewDays.map(
      (each) => new ReviewDayResponseDto(each),
    );
    this.bots = shipping.bots.map((each) => new ReviewBotResponseDto(each));
    this.pipeline = new PipelineFlowResponseDto(shipping.pipeline);
    this.shippedAny = shipping.shippedAny;
  }
}
