import { InvalidJudgeCriteriaError } from '@shared-kernel/domain/exceptions/invalid-judge-criteria.error';
import {
  ALL_CLAIMS,
  claimsPass,
  isPassThreshold,
} from '@shared-kernel/domain/value-objects/claim-share';

export const MAX_CLAIMS = 20;

export const MAX_CLAIM_LENGTH = 500;

export class JudgeCriteria {
  private constructor(
    readonly claims: readonly string[],
    readonly passThreshold: number,
  ) {}

  static of(input: {
    claims: readonly string[];
    passThreshold?: number;
  }): JudgeCriteria {
    const claims = input.claims.map((each) => each.trim());
    const passThreshold = input.passThreshold ?? ALL_CLAIMS;

    if (claims.length === 0 || claims.length > MAX_CLAIMS) {
      throw new InvalidJudgeCriteriaError(
        `must list 1 to ${MAX_CLAIMS} claims`,
      );
    }
    if (claims.some((each) => !each || each.length > MAX_CLAIM_LENGTH)) {
      throw new InvalidJudgeCriteriaError(
        `claims must each be 1 to ${MAX_CLAIM_LENGTH} characters`,
      );
    }
    if (!isPassThreshold(passThreshold)) {
      throw new InvalidJudgeCriteriaError(
        'pass threshold must be above 0, up to 1',
      );
    }

    return new JudgeCriteria(claims, passThreshold);
  }

  static readable(input: {
    claims: readonly string[];
    passThreshold?: number;
  }): JudgeCriteria | null {
    try {
      return JudgeCriteria.of(input);
    } catch (error) {
      if (error instanceof InvalidJudgeCriteriaError) {
        return null;
      }
      throw error;
    }
  }

  passes(claimResults: readonly boolean[]): boolean {
    return (
      claimResults.length === this.claims.length &&
      claimsPass(claimResults, this.passThreshold)
    );
  }

  equals(other: JudgeCriteria): boolean {
    return (
      this.passThreshold === other.passThreshold &&
      this.claims.length === other.claims.length &&
      this.claims.every((each, at) => each === other.claims[at])
    );
  }
}
