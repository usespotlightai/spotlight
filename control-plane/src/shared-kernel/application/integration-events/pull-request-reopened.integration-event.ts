export const PULL_REQUEST_REOPENED = 'github.pull-request-reopened.v1';

export type PullRequestReopenedIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_REOPENED;
  readonly workspaceId: string;
  readonly pullRequest: string;
  readonly repository: string;
  readonly gitHubId: number | null;
  readonly reopenedAt: string | null;
};
