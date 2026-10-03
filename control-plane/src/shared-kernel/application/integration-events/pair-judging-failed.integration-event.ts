export const PAIR_JUDGING_FAILED = 'outcomes.pair-judging-failed.v1';

export type PairJudgingFailedIntegrationEvent = {
  readonly kind: typeof PAIR_JUDGING_FAILED;
  readonly runId: string;
  readonly againstRunId: string;
  readonly workspaceId: string;
  readonly failure: string;
  readonly spentCosts: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpricedCalls: number;
};
