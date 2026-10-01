export const RUN_ENDED = 'work.run-ended.v1';

export type RunEnding = 'completed' | 'failed' | 'abandoned' | 'withdrawn';

export type RunEndedIntegrationEvent = {
  readonly kind: typeof RUN_ENDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
  readonly outcome: RunEnding;
  readonly failure: string | null;
  readonly stopped: boolean;
};
