export const CONFIG_PULL_REQUEST_OPENED =
  'replays.config-pull-request-opened.v1';

export type ConfigPullRequestOpenedIntegrationEvent = {
  readonly kind: typeof CONFIG_PULL_REQUEST_OPENED;
  readonly configPullRequestId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly url: string;
  readonly openedAt: string;
};
