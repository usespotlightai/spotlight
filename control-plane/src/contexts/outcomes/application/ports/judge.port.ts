import type { Verdict } from '@outcomes/domain/aggregates/judging.aggregate';
import type {
  JudgedHunk,
  JudgedStep,
} from '@outcomes/domain/services/judge-evidence';
import type { ScoreKind } from '@outcomes/domain/value-objects/score-scale.vo';

export const JUDGE = Symbol('OUTCOMES_JUDGE');

export interface JudgeAsk {
  readonly rubric: string;
  readonly scale: ScoreKind;
  readonly title: string;
  readonly description: string | null;
  readonly steps: readonly JudgedStep[];
  readonly stepsLeftOut: number;
  readonly hunks: readonly JudgedHunk[];
  readonly hunksLeftOut: number;
}

export interface JudgePort {
  readonly available: boolean;

  readonly model: string;

  judge(ask: JudgeAsk): Promise<Verdict>;
}
