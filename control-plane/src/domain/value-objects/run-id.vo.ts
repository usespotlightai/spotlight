import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class RunId {
  private readonly kind = 'run';

  private constructor(readonly value: string) {}

  static of(value: string): RunId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('run');
    }
    return new RunId(value);
  }

  equals(other: RunId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
