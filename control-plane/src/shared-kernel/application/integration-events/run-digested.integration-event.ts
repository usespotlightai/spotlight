export const RUN_DIGESTED = 'work.run-digested.v1';

export type RunDigestedIntegrationEvent = {
  readonly kind: typeof RUN_DIGESTED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly used: number | null;
  readonly size: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
};
