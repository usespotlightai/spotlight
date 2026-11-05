import { InvalidOidcTrustError } from '@identity/domain/exceptions/invalid-oidc-trust.error';
import { OidcTrustDescription } from '@identity/domain/value-objects/oidc-trust-description.vo';
import { describe, expect, it } from 'vitest';

describe('OidcTrustDescription', () => {
  it('trims the text around it', () => {
    expect(OidcTrustDescription.of('  Deploys main \n').value).toBe(
      'Deploys main',
    );
  });

  it('accepts exactly 1000 characters and rejects one more', () => {
    expect(OidcTrustDescription.of('a'.repeat(1000)).value).toHaveLength(1000);
    expect(() => OidcTrustDescription.of('a'.repeat(1001))).toThrow(
      new InvalidOidcTrustError(
        'description',
        'must be at most 1000 characters',
      ),
    );
  });

  it('counts the length after trimming', () => {
    expect(OidcTrustDescription.of(` ${'a'.repeat(1000)} `).value).toHaveLength(
      1000,
    );
  });
});
