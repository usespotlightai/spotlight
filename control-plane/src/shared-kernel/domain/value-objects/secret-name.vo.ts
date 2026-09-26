import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { SECRET_NAME_SHAPE } from '@shared-kernel/domain/value-objects/identifier-shapes';

const SHAPE = new RegExp(`^${SECRET_NAME_SHAPE}$`);

const REFERENCE = new RegExp(`^secret\\.(${SECRET_NAME_SHAPE})$`);

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

  static referencedBy(written: string): SecretName | null {
    const named = REFERENCE.exec(written.trim())?.[1];

    return named ? new SecretName(named) : null;
  }

  equals(other: SecretName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
