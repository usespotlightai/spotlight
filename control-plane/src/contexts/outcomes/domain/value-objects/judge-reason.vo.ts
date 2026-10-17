import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import type { Citation } from '@outcomes/domain/value-objects/citation.vo';

const MAX_REASON_CHARS = 1_000;

const MAX_CITED = 10;

export class JudgeReason {
  private constructor(
    readonly text: string,
    readonly citations: readonly Citation[],
    readonly claim: number | null,
  ) {}

  static of(input: {
    text: string;
    citations: readonly Citation[];
    claim?: number | null;
  }): JudgeReason {
    const claim = input.claim ?? null;

    const text = input.text.trim();
    const citations = input.citations.filter(
      (each, at, all) => all.findIndex((one) => one.equals(each)) === at,
    );

    if (!text || text.length > MAX_REASON_CHARS) {
      throw new InvalidScoreError(
        `must be 1 to ${MAX_REASON_CHARS} characters`,
        'reason',
      );
    }
    if (citations.length === 0 || citations.length > MAX_CITED) {
      throw new InvalidScoreError(
        `must cite 1 to ${MAX_CITED} steps or hunks of its run`,
        'reason',
      );
    }

    if (claim !== null && (!Number.isInteger(claim) || claim < 0)) {
      throw new InvalidScoreError(
        'must name its claim by list position',
        'reason',
      );
    }

    return new JudgeReason(text, citations, claim);
  }

  aboutClaim(claim: number): JudgeReason {
    return JudgeReason.of({
      text: this.text,
      citations: this.citations,
      claim,
    });
  }
}
