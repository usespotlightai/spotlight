import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class MemoryUpkeepId {
  private readonly kind: string = 'memory-upkeep';

  private constructor(readonly value: string) {}

  static of(value: string): MemoryUpkeepId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('memory upkeep');
    }
    return new MemoryUpkeepId(value);
  }

  equals(other: MemoryUpkeepId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
