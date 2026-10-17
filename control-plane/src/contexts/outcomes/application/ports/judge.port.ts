import type { Verdict } from '@outcomes/domain/services/grounded-verdict';
import type {
  JudgedHunk,
  JudgedStep,
  ReferenceChange,
} from '@outcomes/domain/services/judge-evidence';
import type { ScoreKind } from '@outcomes/domain/value-objects/score-scale.vo';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export const JUDGE = Symbol('OUTCOMES_JUDGE');

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
}

export interface JudgeAnswer {
  readonly verdict: Verdict;
  readonly usage: ModelCall | null;
}

export interface JudgePort {
  readonly available: boolean;

  readonly model: string;

  judge(request: JudgeRequest): Promise<JudgeAnswer>;
}
