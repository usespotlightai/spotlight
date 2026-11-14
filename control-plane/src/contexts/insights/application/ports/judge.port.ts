import type { Verdict } from '@insights/domain/services/grounded-verdict';
import type {
  JudgedHunk,
  JudgedStep,
  ReferenceChange,
} from '@insights/domain/services/judge-evidence';
import type { ScoreKind } from '@insights/domain/value-objects/score-scale.vo';

export const JUDGE = Symbol('INSIGHTS_JUDGE');

export interface JudgeRequest {
  readonly workspaceId: string;
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
  readonly effectsBlocked: boolean;
}

export interface JudgeAnswer {
  readonly verdict: Verdict;
  readonly guidance: string | null;
  readonly model: string;
}

export interface JudgePort {
  availableTo(workspaceId: string): Promise<boolean>;

  judge(request: JudgeRequest): Promise<JudgeAnswer>;
}
