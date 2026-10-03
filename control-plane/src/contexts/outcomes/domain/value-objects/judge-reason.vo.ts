import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import type { Citation } from '@outcomes/domain/value-objects/citation.vo';

const MOST_SAID = 1_000;

const MOST_CITED = 10;

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

    if (!text || text.length > MOST_SAID) {
      throw new InvalidScoreError(
        `says why in 1 to ${MOST_SAID} characters`,
        'reason',
      );
    }
    if (citations.length === 0 || citations.length > MOST_CITED) {
      throw new InvalidScoreError(
        `rests on 1 to ${MOST_CITED} steps or hunks of its run`,
        'reason',
      );
    }

    if (claim !== null && (!Number.isInteger(claim) || claim < 0)) {
      throw new InvalidScoreError(
        'names the claim it is about by its place in the list',
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
