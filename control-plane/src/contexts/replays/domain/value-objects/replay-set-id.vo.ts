import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ReplaySetId {
  private readonly kind = 'replay set';

  private constructor(readonly value: string) {}

  static of(value: string): ReplaySetId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('replay set');
    }
    return new ReplaySetId(value);
  }

  equals(other: ReplaySetId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
