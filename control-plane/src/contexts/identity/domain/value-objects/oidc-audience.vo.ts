import { InvalidOidcTrustError } from '@identity/domain/exceptions/invalid-oidc-trust.error';

const LONGEST = 255;

export class OidcAudience {
  private constructor(readonly value: string) {}

  static of(raw: string): OidcAudience {
    const trimmed = raw.trim();

    if (!trimmed || trimmed.length > LONGEST || /\s/.test(trimmed)) {
      throw new InvalidOidcTrustError(
        'audience',
        `must be one word of at most ${LONGEST} characters, as in spotlight`,
      );
    }

    return new OidcAudience(trimmed);
  }

  among(audiences: readonly string[]): boolean {
    return audiences.includes(this.value);
  }

  equals(other: OidcAudience): boolean {
    return this.value === other.value;
  }
}
