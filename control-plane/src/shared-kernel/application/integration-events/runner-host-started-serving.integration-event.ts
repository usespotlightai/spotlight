export const RUNNER_HOST_STARTED_SERVING = 'runners.host-started-serving.v1';

export type RunnerHostStartedServingIntegrationEvent = {
  readonly kind: typeof RUNNER_HOST_STARTED_SERVING;
  readonly workspaceId: string;
};
