import type { SeenPullRequest } from '@insights/domain/aggregates/pull-request-record.aggregate';
import {
  between,
  type Spending,
  spendingOf,
} from '@insights/domain/services/measures';
import type { PullRequestType } from '@insights/domain/value-objects/pull-request-type';

export const PULL_REQUEST_AUTHORS = [
  'spotlight',
  'reviewed',
  'people',
  'bots',
] as const;

export type PullRequestAuthor = (typeof PULL_REQUEST_AUTHORS)[number];

export const ROUND_BUCKETS = ['0', '1', '2', '3+'] as const;

export type RoundBucket = (typeof ROUND_BUCKETS)[number];

export interface TeamPullRequest {
  readonly pullRequest: string;
  readonly seen: SeenPullRequest;
  readonly by: PullRequestAuthor;
  readonly taskId: string | null;
  readonly reviewTaskIds: readonly string[];
  readonly type: PullRequestType;
  readonly spending: Spending;
}

export interface PullRequestRead {
  readonly pullRequest: string;
  readonly seen: SeenPullRequest;
  readonly ownerTaskId: string | null;
  readonly reviewTaskIds: readonly string[];
  readonly type: PullRequestType;
  readonly spending: Spending;
}

const authorOf = (read: PullRequestRead): PullRequestAuthor => {
  if (read.ownerTaskId !== null) {
    return 'spotlight';
  }

  if (read.reviewTaskIds.length > 0) {
    return 'reviewed';
  }

  return read.seen.authorIsBot ? 'bots' : 'people';
};

export const teamPullRequestFrom = (
  read: PullRequestRead,
): TeamPullRequest => ({
  pullRequest: read.pullRequest,
  seen: read.seen,
  by: authorOf(read),
  taskId: read.ownerTaskId,
  reviewTaskIds: read.reviewTaskIds,
  type: read.type,
  spending: read.ownerTaskId === null ? spendingOf([]) : read.spending,
});

export const toMergeMs = (each: TeamPullRequest): number | null =>
  each.seen.state === 'merged' && each.seen.closedAt
    ? between(each.seen.openedAt, each.seen.closedAt)
    : null;

export const inReviewMs = (each: TeamPullRequest): number | null =>
  each.seen.state !== 'open' && each.seen.firstReviewAt && each.seen.closedAt
    ? between(each.seen.firstReviewAt, each.seen.closedAt)
    : null;

export const roundBucketOf = (rounds: number): RoundBucket => {
  if (rounds >= 3) {
    return '3+';
  }

  return rounds === 2 ? '2' : rounds === 1 ? '1' : '0';
};

export const reverted = (each: TeamPullRequest): boolean =>
  each.seen.revertedBy !== null;
