import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class OidcTrustKey {
  private readonly kind = 'oidc-trust-key';

  private constructor(readonly value: string) {}

  static of(raw: string): OidcTrustKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw new InvalidIdentifierError(
        'OIDC trust key',
        `is lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in github-main`,
      );
    }

    return new OidcTrustKey(named);
  }

  equals(other: OidcTrustKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
