import type { SeenPullRequest } from '@outcomes/domain/aggregates/pull-request-record.aggregate';

const TOMBSTONE_KEPT_DAYS = 210;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PullRequestTombstone {
  readonly updatedAt: Date;
}

export const outlivesTombstone = (
  seen: SeenPullRequest,
  tombstone: PullRequestTombstone,
): boolean => seen.updatedAt.getTime() > tombstone.updatedAt.getTime();

export const tombstonesExpiredBefore = (now: Date): Date =>
  new Date(now.getTime() - TOMBSTONE_KEPT_DAYS * DAY_MS);
