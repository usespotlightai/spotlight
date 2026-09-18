import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';

export const REVIEW_SIDES = ['new', 'old'] as const;

export type ReviewSide = (typeof REVIEW_SIDES)[number];

export class ReviewAnchor {
  private constructor(
    readonly path: string,
    readonly side: ReviewSide,
    readonly line: number,
    readonly startLine: number | null,
  ) {}

  static of(input: {
    path: string;
    side: string;
    line: number;
    startLine?: number | null;
  }): ReviewAnchor {
    const path = input.path.trim().replace(/^\/+/, '');
    const startLine =
      input.startLine === undefined ||
      input.startLine === null ||
      input.startLine === input.line
        ? null
        : input.startLine;

    if (!path) {
      throw new InvalidReviewError('comment is on a file with no path');
    }
    if (!(REVIEW_SIDES as readonly string[]).includes(input.side)) {
      throw new InvalidReviewError(
        'comment is on the new or the old side of a change',
      );
    }
    if (!Number.isInteger(input.line) || input.line < 1) {
      throw new InvalidReviewError('comment is on a line numbered from 1');
    }
    if (
      startLine !== null &&
      (!Number.isInteger(startLine) || startLine < 1 || startLine > input.line)
    ) {
      throw new InvalidReviewError(
        'comment on several lines starts on a line before the one it ends on',
      );
    }

    return new ReviewAnchor(
      path,
      input.side as ReviewSide,
      input.line,
      startLine,
    );
  }

  get firstLine(): number {
    return this.startLine ?? this.line;
  }

  equals(other: ReviewAnchor): boolean {
    return (
      this.path === other.path &&
      this.side === other.side &&
      this.line === other.line &&
      this.startLine === other.startLine
    );
  }
}
