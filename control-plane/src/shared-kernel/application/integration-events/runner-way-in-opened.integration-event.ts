export const RUNNER_WAY_IN_OPENED = 'runners.way-in-opened.v1';

export type RunnerWayInOpenedIntegrationEvent = {
  readonly kind: typeof RUNNER_WAY_IN_OPENED;
  readonly workspaceId: string;
};
