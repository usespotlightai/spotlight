export const PULL_REQUEST_CLOSED = 'github.pull-request-closed.v1';

export type PullRequestClosedIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_CLOSED;
  readonly workspaceId: string;
  readonly pullRequest: string;
  readonly repository: string;
  readonly gitHubId: number | null;
  readonly closedAt: string | null;
} & (
  | { readonly merged: true; readonly mergeCommit: string }
  | { readonly merged: false; readonly mergeCommit: null }
);
