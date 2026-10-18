export const REPLAY_RUN_USAGE_RECORDED = 'work.replay-run-usage-recorded.v1';

export type ReplayRunUsageRecordedIntegrationEvent = {
  readonly kind: typeof REPLAY_RUN_USAGE_RECORDED;
  readonly runId: string;
  readonly replayOf: string;
  readonly workspaceId: string;
  readonly ms: number | null;
  readonly steps: number;
  readonly changedLines: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
};
