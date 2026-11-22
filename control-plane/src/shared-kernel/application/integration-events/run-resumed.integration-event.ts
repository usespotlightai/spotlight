export const RUN_RESUMED = 'runs.run-resumed.v1';

export type RunResumedIntegrationEvent = {
  readonly kind: typeof RUN_RESUMED;
  readonly runId: string;
  readonly workspaceId: string;
};
