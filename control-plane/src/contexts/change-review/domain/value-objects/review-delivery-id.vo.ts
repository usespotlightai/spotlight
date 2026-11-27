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
    return other instanceof ReviewDeliveryId && this.value === other.value;
  }
}
