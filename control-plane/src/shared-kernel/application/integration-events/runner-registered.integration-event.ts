export const RUNNER_REGISTERED = 'runners.runner-registered.v1';

export type RunnerRegisteredIntegrationEvent = {
  readonly kind: typeof RUNNER_REGISTERED;
  readonly runnerId: string;
  readonly workspaceId: string;
};
