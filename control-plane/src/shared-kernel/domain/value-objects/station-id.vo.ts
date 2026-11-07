import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class StationId {
  private readonly kind = 'station';

  private constructor(readonly value: string) {}

  static of(value: string): StationId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('station');
    }
    return new StationId(value);
  }

  equals(other: StationId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
