export const PULL_REQUEST_FORGOTTEN = 'github.pull-request-forgotten.v1';

export type PullRequestForgottenIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_FORGOTTEN;
  readonly workspaceId: string;
  readonly pullRequest: string;
  readonly updatedAt: string;
};
