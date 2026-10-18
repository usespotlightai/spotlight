export const PULL_REQUEST_PURGED = 'github.pull-request-purged.v1';

export type PullRequestPurgedIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_PURGED;
  readonly workspaceId: string;
  readonly pullRequest: string;
  readonly updatedAt: string;
};
