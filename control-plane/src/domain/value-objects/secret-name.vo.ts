import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/** Named the way the environment names things, because that is what it reads as. */
const SHAPE = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * What a workspace calls one of its secrets. The name is all Spotlight ever
 * shows: configuration refers to a secret by it, and what it stands for is
 * held apart from the configuration that names it.
 */
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
