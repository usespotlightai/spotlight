export const PULL_REQUEST_CONFLICTED = 'github.pull-request-conflicted.v1';

export type PullRequestConflictedIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_CONFLICTED;
  readonly workspaceId: string;
  readonly pullRequest: string;
  readonly repository: string;
  readonly branch: string | null;
  readonly base: string;
};
