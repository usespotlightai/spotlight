export const CHANGE_JUDGING = Symbol('CHANGE_JUDGING');

export interface ChangeJudgingAsk {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly rubric: string;
  readonly reference: string | null;
}

export type ChangeJudgingAnswer = 'asked' | 'unavailable' | 'unreadable-rubric';

export type ChangeJudgingAgainAnswer = 'asked' | 'unavailable' | 'unjudged';

export interface ChangeJudgingPort {
  ask(asked: ChangeJudgingAsk): Promise<ChangeJudgingAnswer>;

  askAgain(runId: string): Promise<ChangeJudgingAgainAnswer>;
}
