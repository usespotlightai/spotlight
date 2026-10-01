import type { RecordedState } from '@github/domain/events/pull-request-recorded.event';

const PULL_REQUEST_RETENTION_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetainedPullRequest {
  readonly state: RecordedState;
  readonly closedAt: Date | null;
  readonly updatedAt: Date;
}

export const forgettableBefore = (now: Date): Date =>
  new Date(now.getTime() - PULL_REQUEST_RETENTION_DAYS * DAY_MS);

export const pastRetention = (
  pullRequest: RetainedPullRequest,
  now: Date,
): boolean => {
  const before = forgettableBefore(now).getTime();

  if (pullRequest.state !== 'open') {
    return (
      pullRequest.closedAt !== null && pullRequest.closedAt.getTime() < before
    );
  }

  return pullRequest.updatedAt.getTime() < before;
};
