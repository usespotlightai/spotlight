import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class UpkeepProposalId {
  private readonly kind: string = 'upkeep-proposal';

  private constructor(readonly value: string) {}

  static of(value: string): UpkeepProposalId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('memory upkeep proposal');
    }
    return new UpkeepProposalId(value);
  }

  equals(other: UpkeepProposalId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
