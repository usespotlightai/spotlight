export const RUN_ENDED = 'work.run-ended.v1';

export type RunEndedIntegrationEvent = {
  readonly kind: typeof RUN_ENDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
};
