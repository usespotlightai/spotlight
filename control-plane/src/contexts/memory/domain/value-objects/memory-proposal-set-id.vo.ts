import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class MemoryProposalSetId {
  private readonly kind = 'memory-proposal-set';

  private constructor(readonly value: string) {}

  static of(value: string): MemoryProposalSetId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('memory proposal set');
    }
    return new MemoryProposalSetId(value);
  }

  equals(other: MemoryProposalSetId): boolean {
    return other instanceof MemoryProposalSetId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
