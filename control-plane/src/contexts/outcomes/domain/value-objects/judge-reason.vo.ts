import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import type { Citation } from '@outcomes/domain/value-objects/citation.vo';

const MOST_SAID = 1_000;

const MOST_CITED = 10;

export class JudgeReason {
  private constructor(
    readonly text: string,
    readonly citations: readonly Citation[],
  ) {}

  static of(input: {
    text: string;
    citations: readonly Citation[];
  }): JudgeReason {
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

    return new JudgeReason(text, citations);
  }
}
