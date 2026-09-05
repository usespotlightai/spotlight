import { InvalidSecretError } from '@domain/exceptions/invalid-secret.error';

// Whitespace is preserved, so only a wholly blank value counts as absent.
export class SecretValue {
  private constructor(readonly value: string) {}

  static of(raw: string): SecretValue {
    const secret = SecretValue.maybe(raw);

    if (!secret) {
      throw new InvalidSecretError();
    }

    return secret;
  }

  static maybe(raw: string): SecretValue | null {
    return raw.trim().length === 0 ? null : new SecretValue(raw);
  }
}
