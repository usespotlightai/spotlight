import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import {
  claimShareOf,
  claimsPass,
  isPassThreshold,
} from '@shared-kernel/domain/value-objects/claim-share';
import { judgeGuidanceOf } from '@shared-kernel/domain/value-objects/judge-guidance';

export interface CitedReason {
  readonly text: string;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
  readonly claim: number | null;
}

export class JudgeVerdict {
  private constructor(
    readonly claimResults: readonly boolean[],
    readonly claims: readonly string[],
    readonly passThreshold: number,
    readonly model: string,
    readonly referenced: boolean,
    readonly reasons: readonly CitedReason[],
    readonly guidance: string | null,
  ) {}

  static of(input: {
    claimResults: readonly boolean[];
    claims: readonly string[];
    passThreshold: number;
    model: string;
    referenced: boolean;
    reasons: readonly CitedReason[];
    guidance: string | null;
  }): JudgeVerdict {
    const { claimResults, passThreshold } = input;

    if (claimResults.length === 0) {
      throw new InvalidReplayError('judge must mark each claim');
    }
    if (claimResults.length !== input.claims.length) {
      throw new InvalidReplayError(
        'judge must name exactly the claims it marks',
      );
    }
    if (!isPassThreshold(passThreshold)) {
      throw new InvalidReplayError(
        'judge pass threshold must be above 0, up to 1',
      );
    }

    return new JudgeVerdict(
      [...claimResults],
      [...input.claims],
      passThreshold,
      input.model,
      input.referenced,
      input.reasons.map((each) => ({
        text: each.text,
        steps: [...each.steps],
        hunks: [...each.hunks],
        claim: each.claim,
      })),
      claimsPass(claimResults, passThreshold)
        ? null
        : judgeGuidanceOf(input.guidance),
    );
  }

  get value(): number {
    return claimShareOf(this.claimResults);
  }

  get passes(): boolean {
    return claimsPass(this.claimResults, this.passThreshold);
  }

  equals(other: JudgeVerdict): boolean {
    return (
      JSON.stringify(this.claimResults) ===
        JSON.stringify(other.claimResults) &&
      JSON.stringify(this.claims) === JSON.stringify(other.claims) &&
      this.passThreshold === other.passThreshold &&
      this.model === other.model &&
      this.referenced === other.referenced &&
      JSON.stringify(this.reasons) === JSON.stringify(other.reasons) &&
      this.guidance === other.guidance
    );
  }
}
