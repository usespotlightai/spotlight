export const PAIR_JUDGED = 'outcomes.pair-judged.v1';

export type PairJudgedIntegrationEvent = {
  readonly kind: typeof PAIR_JUDGED;
  readonly runId: string;
  readonly againstRunId: string;
  readonly workspaceId: string;
  readonly winner: 'run' | 'against' | 'tie';
  readonly model: string;
  readonly readings: readonly {
    readonly runShownFirst: boolean;
    readonly winner: 'run' | 'against' | 'tie';
    readonly reasons: readonly {
      readonly text: string;
      readonly runHunks: readonly string[];
      readonly againstHunks: readonly string[];
    }[];
  }[];
  readonly spentCosts: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpricedCalls: number;
  readonly at: string;
};
