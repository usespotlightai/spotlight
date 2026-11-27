import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ReviewWorkId {
  private readonly kind = 'review-work';

  private constructor(readonly value: string) {}

  static of(value: string): ReviewWorkId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('review work');
    }
    return new ReviewWorkId(value);
  }

  equals(other: ReviewWorkId): boolean {
    return other instanceof ReviewWorkId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
