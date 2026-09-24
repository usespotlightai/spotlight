import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class SecretId {
  private readonly kind = 'secret';

  private constructor(readonly value: string) {}

  static of(value: string): SecretId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('secret');
    }
    return new SecretId(value);
  }

  equals(other: SecretId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
