export const SIDE_BY_SIDE_JUDGED = 'insights.side-by-side-judged.v1';

export type SideBySideJudgedIntegrationEvent = {
  readonly kind: typeof SIDE_BY_SIDE_JUDGED;
  readonly runId: string;
  readonly otherRunId: string;
  readonly workspaceId: string;
  readonly winner: 'run' | 'other' | 'tie';
  readonly model: string;
  readonly passes: readonly {
    readonly runShownFirst: boolean;
    readonly winner: 'run' | 'other' | 'tie';
    readonly reasons: readonly {
      readonly text: string;
      readonly runHunks: readonly string[];
      readonly otherHunks: readonly string[];
    }[];
  }[];
  readonly spentCosts: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpricedCalls: number;
  readonly at: string;
};
