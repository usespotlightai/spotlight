import type {
  CitedReason,
  JudgeEvidence,
} from '@insights/domain/services/judge-evidence';
import type { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';

export const MAX_REASONS = 5;

export const MAX_REASONS_PER_CLAIM = 3;

export interface ClaimVerdict {
  readonly index: number;
  readonly met: boolean;
  readonly reasons: readonly CitedReason[];
}

export interface Verdict {
  readonly claims: readonly ClaimVerdict[];
}

export type GroundedVerdict =
  | {
      readonly grounded: true;
      readonly claimResults: readonly boolean[];
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

  return {
    grounded: true,
    claimResults: ordered.map((each) => each.met),
    reasons,
  };
};

export const groundedVerdict = (
  criteria: JudgeCriteria,
  verdict: Verdict,
  evidence: JudgeEvidence,
): GroundedVerdict =>
  groundedOnClaims(criteria.claims.length, verdict.claims, evidence);
