import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class DecisionSetId {
  private readonly kind = 'decision-set';

  private constructor(readonly value: string) {}

  static of(value: string): DecisionSetId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('decision set');
    }
    return new DecisionSetId(value);
  }

  equals(other: DecisionSetId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
