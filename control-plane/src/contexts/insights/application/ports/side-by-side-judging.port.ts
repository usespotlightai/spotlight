export const SIDE_BY_SIDE_JUDGING = Symbol('SIDE_BY_SIDE_JUDGING');

export interface SideBySideJudgingRequest {
  readonly runId: string;
  readonly otherRunId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly reference: string;
  readonly maxAttempts: number;
}

export type SideBySideJudgingAnswer =
  | 'requested'
  | 'unavailable'
  | 'unreadable-rubric';

export interface SideBySideJudgingPort {
  request(request: SideBySideJudgingRequest): Promise<SideBySideJudgingAnswer>;
}
