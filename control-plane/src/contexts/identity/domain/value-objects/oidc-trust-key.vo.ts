import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class OidcTrustKey {
  private readonly kind = 'oidc-trust-key';

  private constructor(readonly value: string) {}

  static of(raw: string): OidcTrustKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw InvalidIdentifierError.notSlug('OIDC trust key', 'github-main');
    }

    return new OidcTrustKey(named);
  }

  equals(other: OidcTrustKey): boolean {
    return other instanceof OidcTrustKey && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
