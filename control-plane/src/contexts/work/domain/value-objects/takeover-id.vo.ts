import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class TakeoverId {
  private readonly kind = 'takeover';

  private constructor(readonly value: string) {}

  static of(value: string): TakeoverId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('takeover');
    }
    return new TakeoverId(value);
  }

  equals(other: TakeoverId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
