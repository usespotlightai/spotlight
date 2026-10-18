export const RUNNER_ACCESS_DEFINED = 'runners.runner-access-defined.v1';

export type RunnerAccessDefinedIntegrationEvent = {
  readonly kind: typeof RUNNER_ACCESS_DEFINED;
  readonly workspaceId: string;
};
