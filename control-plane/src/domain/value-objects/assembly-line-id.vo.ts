import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class AssemblyLineId {
  private readonly kind = 'assembly-line';

  private constructor(readonly value: string) {}

  static of(value: string): AssemblyLineId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('assembly line');
    }
    return new AssemblyLineId(value);
  }

  equals(other: AssemblyLineId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
