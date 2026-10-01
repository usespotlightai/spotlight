import type {
  PullRequestRecord,
  SeenPullRequest,
} from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import type { TaskChangeShape } from '@outcomes/domain/aggregates/task-change-shape.aggregate';
import {
  between,
  type Spending,
  spendingOf,
} from '@outcomes/domain/services/measures';
import { pullRequestTypeOf } from '@outcomes/domain/services/pull-request-types';
import type { PullRequestType } from '@outcomes/domain/value-objects/pull-request-type';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

export const PULL_REQUEST_AUTHORS = [
  'spotlight',
  'touched',
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

const authorOf = (
  record: PullRequestRecord,
  seen: SeenPullRequest,
): PullRequestAuthor => {
  if (record.owner) {
    return 'spotlight';
  }

  if (record.reviewTasks.length > 0) {
    return 'touched';
  }

  return seen.authorIsBot ? 'bots' : 'people';
};

export const teamPullRequestOf = (
  record: PullRequestRecord,
  shape: TaskChangeShape | null,
  spends: readonly (Spend | null)[],
): TeamPullRequest | null => {
  const seen = record.seen;

  if (!seen) {
    return null;
  }

  const shaped = record.owner ? shape?.shape : undefined;

  return {
    pullRequest: record.pullRequest.value,
    seen,
    by: authorOf(record, seen),
    taskId: record.owner?.taskId.value ?? null,
    reviewTaskIds: record.reviewTasks.map((each) => each.value),
    type: pullRequestTypeOf({
      changeTitles: shaped?.changeTitles ?? [],
      changeIntents: shaped?.changeIntents ?? [],
      title: seen.title,
      branch: seen.branch,
    }),
    spending: spendingOf(record.owner ? spends : []),
  };
};

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
