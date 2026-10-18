export const SEARCH_RUN_USAGE_RECORDED = 'work.search-run-usage-recorded.v1';

export type SearchRunUsageRecordedIntegrationEvent = {
  readonly kind: typeof SEARCH_RUN_USAGE_RECORDED;
  readonly runId: string;
  readonly searchId: string;
  readonly workspaceId: string;
  readonly ms: number | null;
  readonly steps: number;
  readonly spentCosts: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpricedCalls: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
};
