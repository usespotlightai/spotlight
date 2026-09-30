export const RUN_SUPERSEDED = 'work.run-superseded.v1';

export type RunSupersededIntegrationEvent = {
  readonly kind: typeof RUN_SUPERSEDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
};
