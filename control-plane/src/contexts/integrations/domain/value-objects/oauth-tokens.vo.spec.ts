import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('OAuthTokens', () => {
  it('keeps the tokens that the service gives', () => {
    const at = new Date('2026-09-07T11:00:00.000Z');
    const tokens = OAuthTokens.of({
      accessToken: 'xoxb-1',
      refreshToken: 'xoxe-1',
      expiresAt: at,
      scopes: ['chat:write'],
      linkedAccount: 'Acme',
    });

    expect(tokens.accessToken.value).toBe('xoxb-1');
    expect(tokens.refreshToken?.value).toBe('xoxe-1');
    expect(tokens.expiresAt).toBe(at);
    expect(tokens.scopes).toEqual(['chat:write']);
    expect(tokens.linkedAccount).toBe('Acme');
  });

  it('contains nothing where the service returns nothing but a token', () => {
    const tokens = OAuthTokens.of({ accessToken: 'xoxb-1' });

    expect(tokens.refreshToken).toBeNull();
    expect(tokens.expiresAt).toBeNull();
    expect(tokens.scopes).toEqual([]);
    expect(tokens.linkedAccount).toBeNull();
  });

  it('reads a blank refresh token or linked account as none', () => {
    const tokens = OAuthTokens.of({
      accessToken: 'xoxb-1',
      refreshToken: '  ',
      linkedAccount: '',
    });

    expect(tokens.refreshToken).toBeNull();
    expect(tokens.linkedAccount).toBeNull();
  });

  it('rejects tokens with no access token', () => {
    expect(() => OAuthTokens.of({ accessToken: '  ' })).toThrow(
      InvalidIdentifierError,
    );
  });
});
