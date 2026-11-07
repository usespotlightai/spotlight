import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';

export const REVIEW_VERDICTS = [
  'comment',
  'approve',
  'request-changes',
] as const;

export type ReviewVerdictName = (typeof REVIEW_VERDICTS)[number];

export class ReviewVerdict {
  private constructor(readonly value: ReviewVerdictName) {}

  static fromInput(raw: string | null): ReviewVerdict {
    const named = raw?.trim() || 'comment';
    const verdict = REVIEW_VERDICTS.find((each) => each === named);

    if (!verdict) {
      throw new InvalidToolInputError(
        'review',
        `verdict must be one of ${REVIEW_VERDICTS.join(', ')}, not ${named}`,
      );
    }

    return new ReviewVerdict(verdict);
  }
}
