export const RUNNER_REVOKED = 'runners.runner-revoked.v1';

export type RunnerRevokedIntegrationEvent = {
  readonly kind: typeof RUNNER_REVOKED;
  readonly runnerId: string;
  readonly workspaceId: string;
};
