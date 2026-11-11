import { InvalidOidcTrustError } from '@identity/domain/exceptions/invalid-oidc-trust.error';

const LONGEST = 255;

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export class OidcIssuer {
  private constructor(readonly value: string) {}

  static of(raw: string): OidcIssuer {
    const trimmed = raw.trim();
    const invalid = new InvalidOidcTrustError(
      'issuer',
      'must be an https URL with no query or fragment, as in https://token.actions.githubusercontent.com',
    );
    let url: URL;

    try {
      url = new URL(trimmed);
    } catch {
      throw invalid;
    }

    const secure =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOOPBACK.has(url.hostname));

    if (
      !secure ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      trimmed.length > LONGEST
    ) {
      throw invalid;
    }

    return new OidcIssuer(trimmed);
  }

  issued(issuer: string): boolean {
    return issuer === this.value;
  }

  equals(other: OidcIssuer): boolean {
    return this.value === other.value;
  }
}
