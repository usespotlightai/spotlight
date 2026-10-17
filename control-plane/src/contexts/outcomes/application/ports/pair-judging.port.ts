export const PAIR_JUDGING = Symbol('PAIR_JUDGING');

export interface PairJudgingRequest {
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

export type PairJudgingAnswer =
  | 'requested'
  | 'unavailable'
  | 'unreadable-rubric';

export interface PairJudgingPort {
  request(request: PairJudgingRequest): Promise<PairJudgingAnswer>;
}
