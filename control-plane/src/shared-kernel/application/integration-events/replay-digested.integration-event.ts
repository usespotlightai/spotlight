export const REPLAY_DIGESTED = 'work.replay-digested.v1';

export type ReplayDigestedIntegrationEvent = {
  readonly kind: typeof REPLAY_DIGESTED;
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
