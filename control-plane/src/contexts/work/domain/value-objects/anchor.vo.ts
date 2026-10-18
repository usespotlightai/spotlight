import { ReviewComment } from '@work/domain/value-objects/review-comment.vo';

export class Anchor {
  private constructor(
    readonly body: string,
    readonly path: string | null,
    readonly from: number | null,
    readonly to: number | null,
    readonly reviewComment: ReviewComment | null,
  ) {}

  static of(input: {
    body?: string | null;
    path?: string | null;
    from?: number | null;
    to?: number | null;
    reviewComment?: string | null;
  }): Anchor | null {
    const body = input.body?.trim() ?? '';
    const path = input.path?.trim() || null;

    return body || path
      ? new Anchor(
          body,
          path,
          input.from ?? null,
          input.to ?? null,
          input.reviewComment ? ReviewComment.of(input.reviewComment) : null,
        )
      : null;
  }

  get parts(): {
    body: string;
    path: string | null;
    from: number | null;
    to: number | null;
    reviewComment: string | null;
  } {
    return {
      body: this.body,
      path: this.path,
      from: this.from,
      to: this.to,
      reviewComment: this.reviewComment?.value ?? null,
    };
  }

  equals(other: Anchor): boolean {
    return (
      this.body === other.body &&
      this.path === other.path &&
      this.from === other.from &&
      this.to === other.to &&
      (this.reviewComment === null
        ? other.reviewComment === null
        : other.reviewComment !== null &&
          this.reviewComment.equals(other.reviewComment))
    );
  }

  get place(): string | null {
    if (!this.path) {
      return null;
    }

    const lines =
      this.from && this.to && this.to !== this.from
        ? `:${this.from}-${this.to}`
        : this.from
          ? `:${this.from}`
          : '';

    return `${this.path}${lines}`;
  }
}
