import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class HoldId {
  private readonly kind = 'hold';

  private constructor(readonly value: string) {}

  static of(value: string): HoldId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('hold');
    }
    return new HoldId(value);
  }

  equals(other: HoldId): boolean {
    return other instanceof HoldId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
