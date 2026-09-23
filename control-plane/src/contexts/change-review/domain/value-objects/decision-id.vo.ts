import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class DecisionId {
  private readonly kind = 'decision';

  private constructor(readonly value: string) {}

  static of(value: string): DecisionId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('decision');
    }
    return new DecisionId(value);
  }

  equals(other: DecisionId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
