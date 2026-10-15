import {
  type PeriodDto,
  type SpreadDto,
  spreadDtoOf,
} from '@outcomes/application/dto/insights.dto';
import type {
  GroupMeasures,
  PullRequestInsights,
  RoundsShare,
  Share,
  TypeShare,
} from '@outcomes/domain/services/pull-request-insights';
import {
  inReviewMs,
  type PullRequestAuthor,
  reverted,
  type TeamPullRequest,
  toMergeMs,
} from '@outcomes/domain/services/team-pull-requests';
import type { DeliveryState } from '@outcomes/domain/value-objects/delivery-state';
import type { PullRequestType } from '@outcomes/domain/value-objects/pull-request-type';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

type ShareDto = Share;

export interface WeekShareDto extends ShareDto {
  readonly week: string;
}

export interface RepositoryPenetrationDto extends ShareDto {
  readonly repository: string;
  readonly weeks: readonly WeekShareDto[];
}

export interface PenetrationDto extends ShareDto {
  readonly weeks: readonly WeekShareDto[];
  readonly repositories: readonly RepositoryPenetrationDto[];
}

export type GroupMeasuresDto = Omit<GroupMeasures, 'toMerge' | 'inReview'> & {
  readonly toMerge: SpreadDto;
  readonly inReview: SpreadDto;
};

export interface ComparisonDto {
  readonly repositories: readonly string[];
  readonly spotlight: GroupMeasuresDto;
  readonly people: GroupMeasuresDto;
}

export type TypeShareDto = TypeShare;

export type RoundsShareDto = RoundsShare;

export interface InsightsPullRequestsDto {
  readonly period: PeriodDto;
  readonly total: number;
  readonly repositories: readonly string[];
  readonly weeks: readonly string[];
  readonly penetration: PenetrationDto;
  readonly comparison: ComparisonDto;
  readonly types: readonly TypeShareDto[];
  readonly depth: readonly RoundsShareDto[];
}

export interface InsightsPullRequestDto {
  readonly pullRequest: string;
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly author: string | null;
  readonly authorIsBot: boolean;
  readonly by: PullRequestAuthor;
  readonly taskId: string | null;
  readonly reviewTaskIds: readonly string[];
  readonly type: PullRequestType;
  readonly state: DeliveryState;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly firstReviewAt: string | null;
  readonly toMergeMs: number | null;
  readonly inReviewMs: number | null;
  readonly reviews: number;
  readonly reviewRounds: number;
  readonly reviewComments: number;
  readonly isRevert: boolean;
  readonly reverted: boolean;
  readonly revertedBy: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly changedFiles: number | null;
  readonly spend: Spend | null;
  readonly unpriced: number;
}

export interface InsightsPullRequestListDto {
  readonly period: PeriodDto;
  readonly total: number;
  readonly page: number;
  readonly size: number;
  readonly pullRequests: readonly InsightsPullRequestDto[];
}

const measuresDtoOf = (measures: GroupMeasures): GroupMeasuresDto => ({
  ...measures,
  toMerge: spreadDtoOf(measures.toMerge),
  inReview: spreadDtoOf(measures.inReview),
});

export const pullRequestInsightsDtoOf = (
  insights: PullRequestInsights,
): Omit<InsightsPullRequestsDto, 'period' | 'total' | 'repositories'> => ({
  weeks: insights.weeks,
  penetration: insights.penetration,
  comparison: {
    repositories: insights.comparison.repositories,
    spotlight: measuresDtoOf(insights.comparison.spotlight),
    people: measuresDtoOf(insights.comparison.people),
  },
  types: insights.types,
  depth: insights.depth,
});

export const insightsPullRequestOf = (
  each: TeamPullRequest,
): InsightsPullRequestDto => ({
  pullRequest: each.pullRequest,
  repository: each.seen.repository,
  number: each.seen.number,
  title: each.seen.title,
  author: each.seen.author,
  authorIsBot: each.seen.authorIsBot,
  by: each.by,
  taskId: each.taskId,
  reviewTaskIds: each.reviewTaskIds,
  type: each.type,
  state: each.seen.state,
  openedAt: each.seen.openedAt.toISOString(),
  closedAt: each.seen.closedAt?.toISOString() ?? null,
  firstReviewAt: each.seen.firstReviewAt?.toISOString() ?? null,
  toMergeMs: toMergeMs(each),
  inReviewMs: inReviewMs(each),
  reviews: each.seen.reviews,
  reviewRounds: each.seen.reviewRounds,
  reviewComments: each.seen.reviewComments,
  isRevert: each.seen.isRevert,
  reverted: reverted(each),
  revertedBy: each.seen.revertedBy,
  additions: each.seen.additions,
  deletions: each.seen.deletions,
  changedFiles: each.seen.changedFiles,
  spend: each.spending.spend,
  unpriced: each.spending.unpriced,
});
