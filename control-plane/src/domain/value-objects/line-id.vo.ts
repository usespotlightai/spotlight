import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class LineId {
  private readonly kind = 'line';

  private constructor(readonly value: string) {}

  static of(value: string): LineId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('line');
    }
    return new LineId(value);
  }

  equals(other: LineId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
