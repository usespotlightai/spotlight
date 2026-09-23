import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';

export const REVIEW_SIDES = ['new', 'old'] as const;

export type ReviewSide = (typeof REVIEW_SIDES)[number];

export interface ReviewLines {
  readonly side: ReviewSide;
  readonly line: number;
  readonly startLine: number | null;
}

export class ReviewAnchor {
  private constructor(
    readonly path: FilePath,
    readonly lines: ReviewLines | null,
  ) {}

  static onFile(path: string): ReviewAnchor {
    return new ReviewAnchor(FilePath.of(path), null);
  }

  static onLines(input: {
    path: string;
    side: string;
    line: number;
    startLine?: number | null;
  }): ReviewAnchor {
    const path = FilePath.of(input.path);
    const startLine =
      input.startLine === undefined ||
      input.startLine === null ||
      input.startLine === input.line
        ? null
        : input.startLine;

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

    return new ReviewAnchor(path, {
      side: input.side as ReviewSide,
      line: input.line,
      startLine,
    });
  }

  get wholeFile(): boolean {
    return this.lines === null;
  }

  equals(other: ReviewAnchor): boolean {
    return (
      this.path.equals(other.path) &&
      this.lines?.side === other.lines?.side &&
      this.lines?.line === other.lines?.line &&
      this.lines?.startLine === other.lines?.startLine
    );
  }
}
