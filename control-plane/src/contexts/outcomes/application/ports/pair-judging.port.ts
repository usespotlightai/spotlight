export const PAIR_JUDGING = Symbol('PAIR_JUDGING');

export interface PairJudgingAsk {
  readonly runId: string;
  readonly against: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passShare: number;
  readonly reference: string;
  readonly maxAttempts: number;
}

export type PairJudgingAnswer = 'asked' | 'unavailable' | 'unreadable-rubric';

export interface PairJudgingPort {
  ask(asked: PairJudgingAsk): Promise<PairJudgingAnswer>;
}
