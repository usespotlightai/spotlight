import type { Verdict } from '@insights/domain/services/grounded-verdict';
import type {
  JudgedHunk,
  JudgedStep,
  ReferenceChange,
} from '@insights/domain/services/judge-evidence';
import type { ScoreKind } from '@insights/domain/value-objects/score-scale.vo';

export const JUDGE = Symbol('INSIGHTS_JUDGE');

export interface JudgeRequest {
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly scale: ScoreKind;
  readonly title: string;
  readonly description: string | null;
  readonly steps: readonly JudgedStep[];
  readonly stepsLeftOut: number;
  readonly hunks: readonly JudgedHunk[];
  readonly hunksLeftOut: number;
  readonly reference: ReferenceChange | null;
  readonly guidanceRequested: boolean;
  readonly replayed: boolean;
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
