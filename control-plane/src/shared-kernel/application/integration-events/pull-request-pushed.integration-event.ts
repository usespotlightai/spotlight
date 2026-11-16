export const PULL_REQUEST_PUSHED = 'github.pull-request-pushed.v1';

export type PullRequestPushedIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_PUSHED;
  readonly workspaceId: string;
  readonly pullRequest: string;
  readonly repository: string;
  readonly head: string;
  readonly baseTip: string;
  readonly pushedBy: string | null;
  readonly byBot: boolean;
  readonly pushedAt: string;
};
