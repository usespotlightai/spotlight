import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import type {
  CitedReason,
  JudgeEvidence,
} from '@outcomes/domain/services/judge-evidence';
import type { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';

export const MOST_REASONS = 5;

export interface Verdict {
  readonly value: boolean | number;
  readonly reasons: readonly CitedReason[];
}

export type GroundedVerdict =
  | {
      readonly grounded: true;
      readonly value: number;
      readonly reasons: readonly JudgeReason[];
    }
  | { readonly grounded: false; readonly failure: 'unreadable' | 'ungrounded' };

export const groundedVerdict = (
  scale: ScoreScale,
  verdict: Verdict,
  evidence: JudgeEvidence,
): GroundedVerdict => {
  let value: number;

  try {
    value = scale.valueOf(verdict.value);
  } catch (error) {
    if (error instanceof InvalidScoreError) {
      return { grounded: false, failure: 'unreadable' };
    }
    throw error;
  }

  if (verdict.reasons.length > MOST_REASONS) {
    return { grounded: false, failure: 'unreadable' };
  }

  const reasons = evidence.groundedReasons(verdict.reasons);

  if (reasons.length * 2 <= verdict.reasons.length) {
    return { grounded: false, failure: 'ungrounded' };
  }

  return { grounded: true, value, reasons };
};
