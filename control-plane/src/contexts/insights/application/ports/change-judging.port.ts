export const CHANGE_JUDGING = Symbol('CHANGE_JUDGING');

export interface ChangeJudgingRequest {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly reference: string | null;
}

export type ChangeJudgingAnswer =
  | 'requested'
  | 'unavailable'
  | 'unreadable-rubric';

export type ChangeJudgingAgainAnswer = 'requested' | 'unavailable' | 'unjudged';

export interface ChangeJudgingPort {
  request(request: ChangeJudgingRequest): Promise<ChangeJudgingAnswer>;

  requeue(runId: string): Promise<ChangeJudgingAgainAnswer>;
}
