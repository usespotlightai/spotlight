import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { ChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import {
  between,
  type Spending,
  spendingOf,
} from '@insights/domain/services/measures';
import { pullRequestTypeOf } from '@insights/domain/services/pull-request-types';
import type { PullRequestType } from '@insights/domain/value-objects/pull-request-type';
import type { SeenPullRequestFields } from '@insights/domain/value-objects/seen-pull-request.vo';

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
  readonly seen: SeenPullRequestFields;
  readonly by: PullRequestAuthor;
  readonly taskId: string | null;
  readonly reviewTaskIds: readonly string[];
  readonly type: PullRequestType;
  readonly spending: Spending;
}

export interface PullRequestRead {
  readonly pullRequest: string;
  readonly seen: SeenPullRequestFields;
  readonly ownerTaskId: string | null;
  readonly reviewTaskIds: readonly string[];
  readonly by: PullRequestAuthor;
  readonly type: PullRequestType;
  readonly spending: Spending;
}

export interface PullRequestFact {
  readonly type: PullRequestType;
  readonly by: PullRequestAuthor;
  readonly rounds: RoundBucket;
  readonly mergedAt: Date | null;
}

const authorOf = (record: PullRequestRecord): PullRequestAuthor => {
  if (record.owner !== null) {
    return 'spotlight';
  }

  if (record.reviewTasks.length > 0) {
    return 'reviewed';
  }

  return record.seen?.authorIsBot ? 'bots' : 'people';
};

export const roundBucketOf = (rounds: number): RoundBucket => {
  if (rounds >= 3) {
    return '3+';
  }

  return rounds === 2 ? '2' : rounds === 1 ? '1' : '0';
};

export const pullRequestFactOf = (
  record: PullRequestRecord,
  shape: ChangeShape | null,
): PullRequestFact | null => {
  const seen = record.seen;

  if (!seen) {
    return null;
  }

  const owned = record.owner !== null;

  return {
    type: pullRequestTypeOf({
      changeTitles: owned && shape ? shape.changeTitles : [],
      changeIntents: owned && shape ? shape.changeIntents : [],
      title: seen.title,
      branch: seen.branch,
    }),
    by: authorOf(record),
    rounds: roundBucketOf(seen.reviewRounds),
    mergedAt: seen.state === 'merged' ? seen.closedAt : null,
  };
};

export const teamPullRequestFrom = (
  read: PullRequestRead,
): TeamPullRequest => ({
  pullRequest: read.pullRequest,
  seen: read.seen,
  by: read.by,
  taskId: read.ownerTaskId,
  reviewTaskIds: read.reviewTaskIds,
  type: read.type,
  spending: read.ownerTaskId === null ? spendingOf([]) : read.spending,
});

export const toMergeMs = (each: TeamPullRequest): number | null =>
  each.seen.state === 'merged' && each.seen.closedAt
    ? between(each.seen.openedAt, each.seen.closedAt)
    : null;

export const reviewedToCloseMs = (each: TeamPullRequest): number | null =>
  each.seen.state !== 'open' && each.seen.firstReviewAt && each.seen.closedAt
    ? between(each.seen.firstReviewAt, each.seen.closedAt)
    : null;

export const reverted = (each: TeamPullRequest): boolean =>
  each.seen.revertedBy !== null;
