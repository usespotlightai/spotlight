import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class EgressId {
  private readonly kind = 'egress';

  private constructor(readonly value: string) {}

  static of(value: string): EgressId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('egress');
    }

    return new EgressId(value);
  }

  equals(other: EgressId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
