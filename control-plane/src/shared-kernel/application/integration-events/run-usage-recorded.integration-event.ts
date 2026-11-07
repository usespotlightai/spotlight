export const RUN_USAGE_RECORDED = 'runs.run-usage-recorded.v1';

type ServerCallsPublished = {
  readonly server: string;
  readonly calls: number;
  readonly failed: number;
  readonly latency: readonly number[];
  readonly lastCallFailed: boolean;
};

export type RunUsageRecordedIntegrationEvent = {
  readonly kind: typeof RUN_USAGE_RECORDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly requester: {
    readonly owner: string;
    readonly kind: string;
    readonly id: string;
    readonly token: string | null;
    readonly team: string | null;
  };
  readonly listed: boolean;
  readonly ms: number | null;
  readonly steps: number;
  readonly errors: number;
  readonly changedLines: number;
  readonly contextTokens: number | null;
  readonly contextWindow: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
  readonly spentCosts: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpricedCalls: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly servers: readonly ServerCallsPublished[];
  readonly skillsRead: readonly string[];
};
