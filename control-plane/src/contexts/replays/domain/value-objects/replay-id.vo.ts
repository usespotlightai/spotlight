import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ReplayId {
  private readonly kind = 'replay';

  private constructor(readonly value: string) {}

  static of(value: string): ReplayId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('replay');
    }
    return new ReplayId(value);
  }

  equals(other: ReplayId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
