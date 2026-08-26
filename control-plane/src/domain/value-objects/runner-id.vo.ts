import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class RunnerId {
  private readonly kind = 'runner';

  private constructor(readonly value: string) {}

  static of(value: string): RunnerId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('runner');
    }
    return new RunnerId(value);
  }

  equals(other: RunnerId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
