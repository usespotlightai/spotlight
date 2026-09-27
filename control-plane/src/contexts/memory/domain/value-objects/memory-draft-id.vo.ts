import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class MemoryDraftId {
  private readonly kind = 'memory-draft';

  private constructor(readonly value: string) {}

  static of(value: string): MemoryDraftId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('memory draft');
    }
    return new MemoryDraftId(value);
  }

  equals(other: MemoryDraftId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
