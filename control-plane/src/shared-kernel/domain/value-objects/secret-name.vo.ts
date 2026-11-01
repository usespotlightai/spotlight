import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { SECRET_NAME_SHAPE } from '@shared-kernel/domain/value-objects/identifier-shapes';

const SHAPE = new RegExp(`^${SECRET_NAME_SHAPE}$`);

const STAND_IN_PREFIX = 'spotlight-egress:';

const REFERENCE = new RegExp(`^secret\\.(${SECRET_NAME_SHAPE})$`);

export class SecretName {
  private constructor(readonly value: string) {}

  static of(raw: string): SecretName {
    const named = raw.trim();

    if (!SHAPE.test(named)) {
      throw new InvalidIdentifierError(
        'secret name',
        'must use only capitals, digits and underscores, such as LINEAR_WEBHOOK_SECRET',
      );
    }

    return new SecretName(named);
  }

  static referencedBy(written: string): SecretName | null {
    const named = REFERENCE.exec(written.trim())?.[1];

    return named ? new SecretName(named) : null;
  }

  get standIn(): string {
    return `${STAND_IN_PREFIX}${this.value}`;
  }

  equals(other: SecretName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
