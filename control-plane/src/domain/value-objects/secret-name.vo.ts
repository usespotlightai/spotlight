import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { SECRET_NAME_SHAPE } from '@domain/value-objects/identifier-shapes';

const SHAPE = new RegExp(`^${SECRET_NAME_SHAPE}$`);

export class SecretName {
  private constructor(readonly value: string) {}

  static of(raw: string): SecretName {
    const named = raw.trim();

    if (!SHAPE.test(named)) {
      throw new InvalidIdentifierError(
        'secret name',
        'is capitals, digits and underscores, as in LINEAR_WEBHOOK_SECRET',
      );
    }

    return new SecretName(named);
  }

  equals(other: SecretName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
