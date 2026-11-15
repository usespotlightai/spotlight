import type { Verdict } from '@insights/domain/services/grounded-verdict';
import type {
  JudgedHunk,
  JudgedStep,
  ReferenceChange,
} from '@insights/domain/services/judge-evidence';

export const JUDGE = Symbol('INSIGHTS_JUDGE');

export interface JudgeRequest {
  readonly claims: readonly string[];
  readonly title: string;
  readonly description: string | null;
  readonly steps: readonly JudgedStep[];
  readonly stepsLeftOut: number;
  readonly hunks: readonly JudgedHunk[];
  readonly hunksLeftOut: number;
  readonly reference: ReferenceChange | null;
  readonly guidanceRequested: boolean;
  readonly effectsBlocked: boolean;
}

export interface JudgeAnswer {
  readonly verdict: Verdict;
  readonly guidance: string | null;
  readonly model: string;
}

export interface JudgePort {
  readonly available: boolean;

  judge(request: JudgeRequest): Promise<JudgeAnswer>;
}
