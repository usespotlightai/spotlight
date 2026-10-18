import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import type {
  CitedReason,
  JudgeEvidence,
} from '@insights/domain/services/judge-evidence';
import type { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import type { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { metRate } from '@insights/domain/value-objects/score-scale.vo';

export const MAX_REASONS = 5;

export const MAX_REASONS_PER_CLAIM = 3;

export interface ClaimVerdict {
  readonly index: number;
  readonly met: boolean;
  readonly reasons: readonly CitedReason[];
}

export type Verdict =
  | {
      readonly value: boolean | number;
      readonly reasons: readonly CitedReason[];
    }
  | { readonly claims: readonly ClaimVerdict[] };

export type GroundedVerdict =
  | {
      readonly grounded: true;
      readonly value: number;
      readonly claimResults: readonly boolean[] | null;
      readonly reasons: readonly JudgeReason[];
    }
  | { readonly grounded: false; readonly failure: 'unreadable' | 'ungrounded' };

const UNREADABLE: GroundedVerdict = { grounded: false, failure: 'unreadable' };

const UNGROUNDED: GroundedVerdict = { grounded: false, failure: 'ungrounded' };

const mostlyGrounded = (grounded: number, total: number): boolean =>
  grounded * 2 > total;

const groundedOnClaims = (
  count: number,
  claims: readonly ClaimVerdict[],
  evidence: JudgeEvidence,
): GroundedVerdict => {
  const ordered = [...claims].sort((one, other) => one.index - other.index);

  if (
    ordered.length !== count ||
    ordered.some(
      (each, at) =>
        each.index !== at ||
        each.reasons.length === 0 ||
        each.reasons.length > MAX_REASONS_PER_CLAIM,
    )
  ) {
    return UNREADABLE;
  }

  const reasons: JudgeReason[] = [];

  for (const claim of ordered) {
    const grounded = evidence.groundedReasons(claim.reasons);

    if (!mostlyGrounded(grounded.length, claim.reasons.length)) {
      return UNGROUNDED;
    }

    reasons.push(...grounded.map((each) => each.aboutClaim(claim.index)));
  }

  const claimResults = ordered.map((each) => each.met);

  return {
    grounded: true,
    value: metRate(claimResults),
    claimResults,
    reasons,
  };
};

export const groundedVerdict = (
  criteria: JudgeCriteria,
  verdict: Verdict,
  evidence: JudgeEvidence,
): GroundedVerdict => {
  if (criteria.scale.byClaims) {
    return 'claims' in verdict
      ? groundedOnClaims(criteria.claims.length, verdict.claims, evidence)
      : UNREADABLE;
  }
  if ('claims' in verdict) {
    return UNREADABLE;
  }

  let value: number;

  try {
    value = criteria.scale.valueOf(verdict.value);
  } catch (error) {
    if (error instanceof InvalidScoreError) {
      return UNREADABLE;
    }
    throw error;
  }

  if (verdict.reasons.length > MAX_REASONS) {
    return UNREADABLE;
  }

  const reasons = evidence.groundedReasons(verdict.reasons);

  if (!mostlyGrounded(reasons.length, verdict.reasons.length)) {
    return UNGROUNDED;
  }

  return { grounded: true, value, claimResults: null, reasons };
};
