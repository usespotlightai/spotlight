import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class MemoryId {
  private readonly kind = 'memory';

  private constructor(readonly value: string) {}

  static of(value: string): MemoryId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('memory');
    }
    return new MemoryId(value);
  }

  equals(other: MemoryId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
