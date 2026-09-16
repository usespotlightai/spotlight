import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class LabelId {
  private readonly kind = 'label';

  private constructor(readonly value: string) {}

  static of(value: string): LabelId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('label');
    }
    return new LabelId(value);
  }

  equals(other: LabelId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
