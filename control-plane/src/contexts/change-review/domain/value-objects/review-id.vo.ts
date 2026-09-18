import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ReviewId {
  private readonly kind = 'review';

  private constructor(readonly value: string) {}

  static of(value: string): ReviewId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('review');
    }
    return new ReviewId(value);
  }

  equals(other: ReviewId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
