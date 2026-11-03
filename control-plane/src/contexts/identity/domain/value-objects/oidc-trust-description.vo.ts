import { InvalidOidcTrustError } from '@identity/domain/exceptions/invalid-oidc-trust.error';
import { trimmedWithin } from '@identity/domain/value-objects/trimmed-within';

const LONGEST = 1000;

export class OidcTrustDescription {
  private readonly kind = 'oidc-trust-description';

  private constructor(readonly value: string) {}

  static of(raw: string): OidcTrustDescription {
    return new OidcTrustDescription(
      trimmedWithin(
        raw,
        LONGEST,
        (because) => new InvalidOidcTrustError('description', because),
      ),
    );
  }

  equals(other: OidcTrustDescription): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
