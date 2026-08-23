import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class FactoryId {
  // Brands the class: without a private member TypeScript compares ids by
  // shape, and every kind of id becomes interchangeable.
  private readonly kind = 'factory';

  private constructor(readonly value: string) {}

  static of(value: string): FactoryId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('factory');
    }
    return new FactoryId(value);
  }

  equals(other: FactoryId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
