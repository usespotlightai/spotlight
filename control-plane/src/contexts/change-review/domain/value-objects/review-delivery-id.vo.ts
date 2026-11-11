import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ReviewDeliveryId {
  private readonly kind = 'review-delivery';

  private constructor(readonly value: string) {}

  static of(value: string): ReviewDeliveryId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('review delivery');
    }
    return new ReviewDeliveryId(value);
  }

  equals(other: ReviewDeliveryId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
