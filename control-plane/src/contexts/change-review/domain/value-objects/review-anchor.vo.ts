import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';

export const REVIEW_SIDES = ['new', 'old'] as const;

export type ReviewSide = (typeof REVIEW_SIDES)[number];

export interface ReviewLines {
  readonly side: ReviewSide;
  readonly line: number;
  readonly startLine: number | null;
}

const alongside = (
  one: RepositoryName | null,
  other: RepositoryName | null,
): boolean => one === null || other === null || one.equals(other);

export class ReviewAnchor {
  private constructor(
    readonly repository: RepositoryName | null,
    readonly path: FilePath,
    readonly lines: ReviewLines | null,
  ) {}

  static onFile(
    path: string,
    repository: RepositoryName | null = null,
  ): ReviewAnchor {
    return new ReviewAnchor(repository, FilePath.of(path), null);
  }

  static onLines(input: {
    repository?: RepositoryName | null;
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
        'comment must be on the new or old side of a change',
      );
    }
    if (!Number.isInteger(input.line) || input.line < 1) {
      throw new InvalidReviewError('comment line must be 1 or more');
    }
    if (
      startLine !== null &&
      (!Number.isInteger(startLine) || startLine < 1 || startLine > input.line)
    ) {
      throw new InvalidReviewError(
        'comment on several lines must start before its last line',
      );
    }

    return new ReviewAnchor(input.repository ?? null, path, {
      side: input.side as ReviewSide,
      line: input.line,
      startLine,
    });
  }

  static at(input: {
    repository?: string | null;
    path: string;
    side: string | null;
    line: number | null;
    startLine: number | null;
  }): ReviewAnchor {
    const repository = RepositoryName.optional(input.repository);

    return input.line === null
      ? ReviewAnchor.onFile(input.path, repository)
      : ReviewAnchor.onLines({
          repository,
          path: input.path,
          side: input.side ?? '',
          line: input.line,
          startLine: input.startLine,
        });
  }

  get wholeFile(): boolean {
    return this.lines === null;
  }

  isIn(repository: RepositoryName | null): boolean {
    return alongside(this.repository, repository);
  }

  sameFileAs(other: ReviewAnchor): boolean {
    return (
      this.path.equals(other.path) &&
      alongside(this.repository, other.repository)
    );
  }

  samePlaceAs(other: ReviewAnchor): boolean {
    return this.sameFileAs(other) && this.sameLinesAs(other);
  }

  equals(other: ReviewAnchor): boolean {
    return (
      (this.repository === null
        ? other.repository === null
        : other.repository !== null &&
          this.repository.equals(other.repository)) &&
      this.path.equals(other.path) &&
      this.sameLinesAs(other)
    );
  }

  private sameLinesAs(other: ReviewAnchor): boolean {
    return (
      this.lines?.side === other.lines?.side &&
      this.lines?.line === other.lines?.line &&
      this.lines?.startLine === other.lines?.startLine
    );
  }
}
