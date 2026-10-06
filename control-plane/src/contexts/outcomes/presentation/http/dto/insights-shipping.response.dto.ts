import { ApiProperty } from '@nestjs/swagger';
import type {
  ByAuthorDto,
  ByTypeDto,
  DepthWeekDto,
  InsightsShippingDto,
  MergeDayDto,
  PercentilesDto,
  PipelineFlowDto,
  ReviewBotDto,
  ReviewDayDto,
  StagePartsDto,
  StageTimesDto,
  StationStageDto,
  TypedStageTimesDto,
  TypeMergeDto,
} from '@outcomes/application/dto/insights-shipping.dto';
import { ROUND_BUCKETS } from '@outcomes/domain/services/team-pull-requests';
import { PULL_REQUEST_TYPES } from '@outcomes/domain/value-objects/pull-request-type';
import { InsightsPeriodResponseDto } from '@outcomes/presentation/http/dto/insights-common.response.dto';

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

  constructor(rounds: DepthWeekDto['rounds'][number]) {
    this.rounds = rounds.rounds;
    this.merged = rounds.merged;
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
    description: 'How many of them took each number of review rounds',
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
      'Of the review threads it started, the share now resolved, from 0 to 1; none where it started none',
  })
  readonly resolvedShare: number | null;

  constructor(bot: ReviewBotDto) {
    this.login = bot.login;
    this.comments = bot.comments;
    this.reviews = bot.reviews;
    this.resolvedShare = bot.resolvedShare;
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

export class StageTimesResponseDto {
  @ApiProperty({ type: PercentilesResponseDto })
  readonly total: PercentilesResponseDto;

  @ApiProperty({
    type: StagePartsResponseDto,
    nullable: true,
    description: 'At a station, the time queued, running and in the inbox',
  })
  readonly parts: StagePartsResponseDto | null;

  constructor(times: StageTimesDto) {
    this.total = new PercentilesResponseDto(times.total);
    this.parts = times.parts ? new StagePartsResponseDto(times.parts) : null;
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

export class StationStageResponseDto {
  @ApiProperty({ example: 'line_delivery' })
  readonly lineId: string;

  @ApiProperty({ example: 'station_implementation' })
  readonly stationId: string;

  @ApiProperty({
    type: ByTypeResponseDto,
    description: 'Time a merged pull request’s task spent at the station',
  })
  readonly times: ByTypeResponseDto;

  constructor(station: StationStageDto) {
    this.lineId = station.lineId;
    this.stationId = station.stationId;
    this.times = new ByTypeResponseDto(station.times);
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
    type: ByTypeResponseDto,
    description: 'Task opened to pull request opened',
  })
  readonly coding: ByTypeResponseDto;

  @ApiProperty({
    type: StationStageResponseDto,
    isArray: true,
    description: 'Each station the tasks went through, in order of first use',
  })
  readonly stations: readonly StationStageResponseDto[];

  @ApiProperty({
    type: ByTypeResponseDto,
    description:
      'Ready for review to the first review by anyone but the author, bots’ included',
  })
  readonly awaitingReview: ByTypeResponseDto;

  @ApiProperty({
    type: ByTypeResponseDto,
    description: 'First review to approval, or to merge where none approved',
  })
  readonly inReview: ByTypeResponseDto;

  @ApiProperty({
    type: ByTypeResponseDto,
    description: 'Approval to merge',
  })
  readonly awaitingMerge: ByTypeResponseDto;

  constructor(pipeline: PipelineFlowDto) {
    this.merged = pipeline.merged;
    this.types = pipeline.types.map(
      (each) => new PipelineTypeResponseDto(each),
    );
    this.coding = new ByTypeResponseDto(pipeline.coding);
    this.stations = pipeline.stations.map(
      (each) => new StationStageResponseDto(each),
    );
    this.awaitingReview = new ByTypeResponseDto(pipeline.awaitingReview);
    this.inReview = new ByTypeResponseDto(pipeline.inReview);
    this.awaitingMerge = new ByTypeResponseDto(pipeline.awaitingMerge);
  }
}

export class InsightsShippingResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({
    example: false,
    description: 'Whether only the latest pull requests or runs were counted',
  })
  readonly truncated: boolean;

  @ApiProperty({
    type: ByAuthorResponseDto,
    description: 'Opened to merged, for pull requests merged in the period',
  })
  readonly toMerge: ByAuthorResponseDto;

  @ApiProperty({
    type: ByAuthorResponseDto,
    description: 'The same, in the period before it',
  })
  readonly toMergeBefore: ByAuthorResponseDto;

  @ApiProperty({ type: MergeDayResponseDto, isArray: true })
  readonly mergeDays: readonly MergeDayResponseDto[];

  @ApiProperty({ type: TypeMergeResponseDto, isArray: true })
  readonly types: readonly TypeMergeResponseDto[];

  @ApiProperty({ type: DepthWeekResponseDto, isArray: true })
  readonly depth: readonly DepthWeekResponseDto[];

  @ApiProperty({ type: ReviewDayResponseDto, isArray: true })
  readonly reviewDays: readonly ReviewDayResponseDto[];

  @ApiProperty({ type: ReviewBotResponseDto, isArray: true })
  readonly bots: readonly ReviewBotResponseDto[];

  @ApiProperty({ type: PipelineFlowResponseDto })
  readonly pipeline: PipelineFlowResponseDto;

  constructor(shipping: InsightsShippingDto) {
    this.period = new InsightsPeriodResponseDto(shipping.period);
    this.truncated = shipping.truncated;
    this.toMerge = new ByAuthorResponseDto(shipping.toMerge);
    this.toMergeBefore = new ByAuthorResponseDto(shipping.toMergeBefore);
    this.mergeDays = shipping.mergeDays.map(
      (each) => new MergeDayResponseDto(each),
    );
    this.types = shipping.types.map((each) => new TypeMergeResponseDto(each));
    this.depth = shipping.depth.map((each) => new DepthWeekResponseDto(each));
    this.reviewDays = shipping.reviewDays.map(
      (each) => new ReviewDayResponseDto(each),
    );
    this.bots = shipping.bots.map((each) => new ReviewBotResponseDto(each));
    this.pipeline = new PipelineFlowResponseDto(shipping.pipeline);
  }
}
