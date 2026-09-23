import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class DecisionDisputeId {
  private readonly kind = 'decision-dispute';

  private constructor(readonly value: string) {}

  static of(value: string): DecisionDisputeId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('decision dispute');
    }
    return new DecisionDisputeId(value);
  }

  equals(other: DecisionDisputeId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
