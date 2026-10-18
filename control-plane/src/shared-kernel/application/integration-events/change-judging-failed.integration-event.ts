export const CHANGE_JUDGING_FAILED = 'insights.change-judging-failed.v1';

export type ChangeJudgingFailedIntegrationEvent = {
  readonly kind: typeof CHANGE_JUDGING_FAILED;
  readonly runId: string;
  readonly attempt: 1 | 2;
  readonly workspaceId: string;
  readonly spentCosts: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpricedCalls: number;
  readonly failure: string;
};
