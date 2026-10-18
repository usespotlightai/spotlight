import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class AlertId {
  private readonly kind = 'alert';

  private constructor(readonly value: string) {}

  static of(value: string): AlertId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('alert');
    }
    return new AlertId(value);
  }

  equals(other: AlertId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
