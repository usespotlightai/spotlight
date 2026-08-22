import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class UserId {
  // Brands the class: without a private member TypeScript compares ids by
  // shape, and every kind of id becomes interchangeable.
  private readonly kind = 'user';

  private constructor(readonly value: string) {}

  static of(value: string): UserId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('user');
    }
    return new UserId(value);
  }

  equals(other: UserId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
