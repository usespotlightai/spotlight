export const SIDE_BY_SIDE_JUDGING_FAILED =
  'insights.side-by-side-judging-failed.v1';

export type SideBySideJudgingFailedIntegrationEvent = {
  readonly kind: typeof SIDE_BY_SIDE_JUDGING_FAILED;
  readonly runId: string;
  readonly otherRunId: string;
  readonly workspaceId: string;
  readonly failure: string;
  readonly spentCosts: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpricedCalls: number;
};
