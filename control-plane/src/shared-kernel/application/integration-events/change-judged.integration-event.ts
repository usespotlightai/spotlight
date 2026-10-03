export const CHANGE_JUDGED = 'outcomes.change-judged.v1';

type JudgedScale = 'yes-no' | 'number' | 'claims';

export type ChangeJudgedIntegrationEvent = {
  readonly kind: typeof CHANGE_JUDGED;
  readonly runId: string;
  readonly round: 1 | 2;
  readonly workspaceId: string;
  readonly spentCosts: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpricedCalls: number;
  readonly scale: JudgedScale;
  readonly value: number;
  readonly marks: readonly boolean[] | null;
  readonly claims: readonly string[];
  readonly passShare: number;
  readonly model: string;
  readonly reasons: readonly {
    readonly text: string;
    readonly steps: readonly number[];
    readonly hunks: readonly string[];
    readonly claim: number | null;
  }[];
  readonly referenced: boolean;
  readonly at: string;
};
