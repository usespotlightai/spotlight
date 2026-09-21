export const PULL_REQUEST_OPENED = 'work.pull-request-opened.v1';

export type PullRequestOpenedIntegrationEvent = {
  readonly kind: typeof PULL_REQUEST_OPENED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly url: string;
};
