import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class TokenTrustKey {
  private readonly kind = 'token-trust-key';

  private constructor(readonly value: string) {}

  static of(raw: string): TokenTrustKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw new InvalidIdentifierError(
        'token trust key',
        `is lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in github-main`,
      );
    }

    return new TokenTrustKey(named);
  }

  equals(other: TokenTrustKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
