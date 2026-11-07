export const RUNNER_ACCESS_CREATED = 'runners.runner-access-created.v1';

export type RunnerAccessCreatedIntegrationEvent = {
  readonly kind: typeof RUNNER_ACCESS_CREATED;
  readonly workspaceId: string;
};
