import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ReviewCommentId {
  private readonly kind = 'review-comment';

  private constructor(readonly value: string) {}

  static of(value: string): ReviewCommentId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('review comment');
    }
    return new ReviewCommentId(value);
  }

  equals(other: ReviewCommentId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
