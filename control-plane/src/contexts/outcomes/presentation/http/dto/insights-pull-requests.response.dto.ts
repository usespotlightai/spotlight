import { ApiProperty } from '@nestjs/swagger';
import type {
  ComparisonDto,
  GroupMeasuresDto,
  InsightsPullRequestDto,
  InsightsPullRequestListDto,
  InsightsPullRequestsDto,
  PenetrationDto,
  RepositoryPenetrationDto,
  RoundsShareDto,
  TypeShareDto,
  WeekShareDto,
} from '@outcomes/application/dto/insights-pull-requests.dto';
import {
  PULL_REQUEST_AUTHORS,
  ROUND_BUCKETS,
} from '@outcomes/domain/services/team-pull-requests';
import { DELIVERY_STATES } from '@outcomes/domain/value-objects/delivery-state';
import { PULL_REQUEST_TYPES } from '@outcomes/domain/value-objects/pull-request-type';
import {
  InsightsPeriodResponseDto,
  SpreadResponseDto,
} from '@outcomes/presentation/http/dto/insights-common.response.dto';
import { SpendResponseDto } from '@outcomes/presentation/http/dto/station-outcomes.response.dto';

export class WeekShareResponseDto {
  @ApiProperty({
    example: '2026-09-28',
    description: 'The Monday, UTC, the week starts on',
  })
  readonly week: string;

  @ApiProperty({ example: 12, description: 'Pull requests merged that week' })
  readonly merged: number;

  @ApiProperty({ example: 5, description: 'Of those, the ones Spotlight made' })
  readonly made: number;

  @ApiProperty({
    example: 2,
    description:
      'Of those, ones people or bots wrote that a Spotlight review task was opened on',
  })
  readonly touched: number;

  @ApiProperty({
    example: 7,
    description: 'Of those, the ones Spotlight made or reviewed',
  })
  readonly spotlight: number;

  @ApiProperty({
    example: 2,
    description: 'Of those, ones people wrote with no Spotlight review task',
  })
  readonly people: number;

  @ApiProperty({
    example: 3,
    description: 'Of those, ones bots wrote with no Spotlight review task',
  })
  readonly bots: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.58,
    description:
      'Made and touched over everything merged, bots’ included, from 0 to 1; none where nothing merged',
  })
  readonly share: number | null;

  constructor(week: WeekShareDto) {
    this.week = week.week;
    this.merged = week.merged;
    this.made = week.made;
    this.touched = week.touched;
    this.spotlight = week.spotlight;
    this.people = week.people;
    this.bots = week.bots;
    this.share = week.share;
  }
}

export class RepositoryPenetrationResponseDto {
  @ApiProperty({ example: 'acme/api' })
  readonly repository: string;

  @ApiProperty({ example: 40 })
  readonly merged: number;

  @ApiProperty({ example: 18 })
  readonly made: number;

  @ApiProperty({ example: 4 })
  readonly touched: number;

  @ApiProperty({ example: 1 })
  readonly bots: number;

  @ApiProperty({ nullable: true, type: Number, example: 0.55 })
  readonly share: number | null;

  @ApiProperty({ type: WeekShareResponseDto, isArray: true })
  readonly weeks: readonly WeekShareResponseDto[];

  constructor(repository: RepositoryPenetrationDto) {
    this.repository = repository.repository;
    this.merged = repository.merged;
    this.made = repository.made;
    this.touched = repository.touched;
    this.bots = repository.bots;
    this.share = repository.share;
    this.weeks = repository.weeks.map((each) => new WeekShareResponseDto(each));
  }
}

export class PenetrationResponseDto {
  @ApiProperty({
    example: 52,
    description:
      'Pull requests merged in the period, across the team, bots’ included',
  })
  readonly merged: number;

  @ApiProperty({ example: 21 })
  readonly made: number;

  @ApiProperty({
    example: 6,
    description: 'Merged ones a Spotlight review task was opened on',
  })
  readonly touched: number;

  @ApiProperty({ example: 4, description: 'Merged ones bots wrote alone' })
  readonly bots: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.52,
    description:
      'Made and touched over everything merged; bots’ pull requests count in the whole',
  })
  readonly share: number | null;

  @ApiProperty({
    type: WeekShareResponseDto,
    isArray: true,
    description: 'The team, week by week, oldest first',
  })
  readonly weeks: readonly WeekShareResponseDto[];

  @ApiProperty({
    type: RepositoryPenetrationResponseDto,
    isArray: true,
    description:
      'Each repository the team’s lines work, and any other its tasks merged into, the busiest first',
  })
  readonly repositories: readonly RepositoryPenetrationResponseDto[];

  constructor(penetration: PenetrationDto) {
    this.merged = penetration.merged;
    this.made = penetration.made;
    this.touched = penetration.touched;
    this.bots = penetration.bots;
    this.share = penetration.share;
    this.weeks = penetration.weeks.map(
      (each) => new WeekShareResponseDto(each),
    );
    this.repositories = penetration.repositories.map(
      (each) => new RepositoryPenetrationResponseDto(each),
    );
  }
}

export class GroupMeasuresResponseDto {
  @ApiProperty({ example: 21, description: 'Pull requests merged' })
  readonly merged: number;

  @ApiProperty({
    type: SpreadResponseDto,
    description: 'From opening to merge',
  })
  readonly toMerge: SpreadResponseDto;

  @ApiProperty({
    type: SpreadResponseDto,
    description: 'From the first review by a person to merge',
  })
  readonly inReview: SpreadResponseDto;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 1.4,
    description:
      'Review rounds per pull request: each approval or request for changes by a person, and any later comments, is a round',
  })
  readonly meanRounds: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 3.2,
    description: 'Review comments by people per pull request',
  })
  readonly meanComments: number | null;

  @ApiProperty({ example: 1, description: 'Merged, then reverted' })
  readonly reverted: number;

  @ApiProperty({ nullable: true, type: Number, example: 0.05 })
  readonly revertRate: number | null;

  constructor(measures: GroupMeasuresDto) {
    this.merged = measures.merged;
    this.toMerge = new SpreadResponseDto(measures.toMerge);
    this.inReview = new SpreadResponseDto(measures.inReview);
    this.meanRounds = measures.meanRounds;
    this.meanComments = measures.meanComments;
    this.reverted = measures.reverted;
    this.revertRate = measures.revertRate;
  }
}

export class ComparisonResponseDto {
  @ApiProperty({
    type: String,
    isArray: true,
    example: ['acme/api'],
    description:
      'The repositories Spotlight merged into in the period; people’s pull requests are counted only in these',
  })
  readonly repositories: readonly string[];

  @ApiProperty({
    type: GroupMeasuresResponseDto,
    description: 'Pull requests Spotlight made',
  })
  readonly spotlight: GroupMeasuresResponseDto;

  @ApiProperty({
    type: GroupMeasuresResponseDto,
    description:
      'Pull requests people wrote with no Spotlight review task opened on them; bots’ are left out',
  })
  readonly people: GroupMeasuresResponseDto;

  constructor(comparison: ComparisonDto) {
    this.repositories = comparison.repositories;
    this.spotlight = new GroupMeasuresResponseDto(comparison.spotlight);
    this.people = new GroupMeasuresResponseDto(comparison.people);
  }
}

export class TypeShareResponseDto {
  @ApiProperty({ enum: PULL_REQUEST_TYPES, example: 'fix' })
  readonly type: string;

  @ApiProperty({
    example: 7,
    description: 'Pull requests of this type Spotlight merged',
  })
  readonly spotlight: number;

  @ApiProperty({
    example: 9,
    description:
      'Pull requests of this type people merged alone, bots’ left out',
  })
  readonly people: number;

  @ApiProperty({
    type: SpendResponseDto,
    nullable: true,
    description:
      'What the runs of Spotlight’s pull requests of this type cost; none where nothing was priced or prices came in more than one currency',
  })
  readonly spend: SpendResponseDto | null;

  @ApiProperty({ example: 0, description: 'Runs with no price' })
  readonly unpriced: number;

  @ApiProperty({ example: false })
  readonly mixedCurrencies: boolean;

  constructor(share: TypeShareDto) {
    this.type = share.type;
    this.spotlight = share.spotlight;
    this.people = share.people;
    this.spend = share.spend ? new SpendResponseDto(share.spend) : null;
    this.unpriced = share.unpriced;
    this.mixedCurrencies = share.mixedCurrencies;
  }
}

export class RoundsShareResponseDto {
  @ApiProperty({ enum: ROUND_BUCKETS, example: '1' })
  readonly rounds: string;

  @ApiProperty({ example: 12 })
  readonly spotlight: number;

  @ApiProperty({
    example: 15,
    description: 'People’s alone, bots’ left out',
  })
  readonly people: number;

  constructor(share: RoundsShareDto) {
    this.rounds = share.rounds;
    this.spotlight = share.spotlight;
    this.people = share.people;
  }
}

export class InsightsPullRequestsResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({
    example: 64,
    description:
      'Pull requests recorded in the team’s repositories that were open at some point in the period, whatever became of them',
  })
  readonly total: number;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['acme/api', 'acme/web'],
    description: 'The repositories the team’s lines work',
  })
  readonly repositories: readonly string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['2026-09-21', '2026-09-28'],
    description: 'The Mondays of every week the period touches, oldest first',
  })
  readonly weeks: readonly string[];

  @ApiProperty({
    type: PenetrationResponseDto,
    description: 'How much of what merged Spotlight made or touched',
  })
  readonly penetration: PenetrationResponseDto;

  @ApiProperty({
    type: ComparisonResponseDto,
    description:
      'Spotlight’s merged pull requests against people’s, in the same repositories',
  })
  readonly comparison: ComparisonResponseDto;

  @ApiProperty({
    type: TypeShareResponseDto,
    isArray: true,
    description: 'What merged, by type, with what Spotlight spent on each',
  })
  readonly types: readonly TypeShareResponseDto[];

  @ApiProperty({
    type: RoundsShareResponseDto,
    isArray: true,
    description:
      'How many review rounds merged pull requests took, Spotlight’s against people’s, in the same repositories',
  })
  readonly depth: readonly RoundsShareResponseDto[];

  constructor(insights: InsightsPullRequestsDto) {
    this.period = new InsightsPeriodResponseDto(insights.period);
    this.total = insights.total;
    this.repositories = insights.repositories;
    this.weeks = insights.weeks;
    this.penetration = new PenetrationResponseDto(insights.penetration);
    this.comparison = new ComparisonResponseDto(insights.comparison);
    this.types = insights.types.map((each) => new TypeShareResponseDto(each));
    this.depth = insights.depth.map((each) => new RoundsShareResponseDto(each));
  }
}

export class InsightsPullRequestResponseDto {
  @ApiProperty({ example: 'https://github.com/acme/api/pull/42' })
  readonly pullRequest: string;

  @ApiProperty({ example: 'acme/api' })
  readonly repository: string;

  @ApiProperty({ example: 42 })
  readonly number: number;

  @ApiProperty({ example: 'Retry failed uploads' })
  readonly title: string;

  @ApiProperty({ nullable: true, type: String, example: 'octocat' })
  readonly author: string | null;

  @ApiProperty({ example: false })
  readonly authorIsBot: boolean;

  @ApiProperty({
    enum: PULL_REQUEST_AUTHORS,
    example: 'spotlight',
    description:
      'spotlight where a task opened it, touched where someone else wrote it and a Spotlight review task was opened on it, bots where a bot wrote it with no such task, people otherwise',
  })
  readonly by: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13',
    description: 'The task that opened it',
  })
  readonly taskId: string | null;

  @ApiProperty({
    type: String,
    isArray: true,
    description: 'The review tasks opened on it',
  })
  readonly reviewTaskIds: readonly string[];

  @ApiProperty({ enum: PULL_REQUEST_TYPES, example: 'feature' })
  readonly type: string;

  @ApiProperty({ enum: DELIVERY_STATES, example: 'merged' })
  readonly state: string;

  @ApiProperty({ example: '2026-09-29T10:00:00.000Z' })
  readonly openedAt: string;

  @ApiProperty({ nullable: true, type: String })
  readonly closedAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly firstReviewAt: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 86_400_000 })
  readonly toMergeMs: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 3_600_000 })
  readonly inReviewMs: number | null;

  @ApiProperty({ example: 2, description: 'Reviews people gave it' })
  readonly reviews: number;

  @ApiProperty({ example: 1 })
  readonly reviewRounds: number;

  @ApiProperty({ example: 3 })
  readonly reviewComments: number;

  @ApiProperty({
    example: false,
    description: 'Whether it reverts another pull request',
  })
  readonly isRevert: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether another merged pull request reverted it',
  })
  readonly reverted: boolean;

  @ApiProperty({ nullable: true, type: String })
  readonly revertedBy: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 120 })
  readonly additions: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 30 })
  readonly deletions: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 4 })
  readonly changedFiles: number | null;

  @ApiProperty({
    type: SpendResponseDto,
    nullable: true,
    description: 'What the runs of the task that opened it cost',
  })
  readonly spend: SpendResponseDto | null;

  @ApiProperty({ example: 0, description: 'Its task’s runs with no price' })
  readonly unpriced: number;

  constructor(pullRequest: InsightsPullRequestDto) {
    this.pullRequest = pullRequest.pullRequest;
    this.repository = pullRequest.repository;
    this.number = pullRequest.number;
    this.title = pullRequest.title;
    this.author = pullRequest.author;
    this.authorIsBot = pullRequest.authorIsBot;
    this.by = pullRequest.by;
    this.taskId = pullRequest.taskId;
    this.reviewTaskIds = pullRequest.reviewTaskIds;
    this.type = pullRequest.type;
    this.state = pullRequest.state;
    this.openedAt = pullRequest.openedAt;
    this.closedAt = pullRequest.closedAt;
    this.firstReviewAt = pullRequest.firstReviewAt;
    this.toMergeMs = pullRequest.toMergeMs;
    this.inReviewMs = pullRequest.inReviewMs;
    this.reviews = pullRequest.reviews;
    this.reviewRounds = pullRequest.reviewRounds;
    this.reviewComments = pullRequest.reviewComments;
    this.isRevert = pullRequest.isRevert;
    this.reverted = pullRequest.reverted;
    this.revertedBy = pullRequest.revertedBy;
    this.additions = pullRequest.additions;
    this.deletions = pullRequest.deletions;
    this.changedFiles = pullRequest.changedFiles;
    this.spend = pullRequest.spend
      ? new SpendResponseDto(pullRequest.spend)
      : null;
    this.unpriced = pullRequest.unpriced;
  }
}

export class InsightsPullRequestListResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({ example: 52, description: 'Pull requests that match' })
  readonly total: number;

  @ApiProperty({ example: 1 })
  readonly page: number;

  @ApiProperty({ example: 50 })
  readonly size: number;

  @ApiProperty({
    type: InsightsPullRequestResponseDto,
    isArray: true,
    description: 'This page, the most recently closed or opened first',
  })
  readonly pullRequests: readonly InsightsPullRequestResponseDto[];

  constructor(list: InsightsPullRequestListDto) {
    this.period = new InsightsPeriodResponseDto(list.period);
    this.total = list.total;
    this.page = list.page;
    this.size = list.size;
    this.pullRequests = list.pullRequests.map(
      (each) => new InsightsPullRequestResponseDto(each),
    );
  }
}
