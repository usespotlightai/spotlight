export const PULL_REQUEST_REVIEW_TAKEN = 'work.pull-request-review-taken.v1';

export type PullRequestReviewTakenIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_REVIEW_TAKEN;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly url: string;
};
