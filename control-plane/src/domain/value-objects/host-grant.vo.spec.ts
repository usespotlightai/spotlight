import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { HostGrant } from '@domain/value-objects/host-grant.vo';
import { describe, expect, it } from 'vitest';

describe('HostGrant', () => {
  it('keeps what a host grants', () => {
    const at = new Date('2026-09-07T11:00:00.000Z');
    const grant = HostGrant.of({
      accessToken: 'xoxb-1',
      refreshToken: 'xoxe-1',
      expiresAt: at,
      scopes: ['chat:write'],
      handle: 'Acme',
    });

    expect(grant.accessToken).toBe('xoxb-1');
    expect(grant.refreshToken).toBe('xoxe-1');
    expect(grant.expiresAt).toBe(at);
    expect(grant.scopes).toEqual(['chat:write']);
    expect(grant.handle).toBe('Acme');
  });

  it('holds nothing where a host gives nothing but a token', () => {
    const grant = HostGrant.of({ accessToken: 'xoxb-1' });

    expect(grant.refreshToken).toBeNull();
    expect(grant.expiresAt).toBeNull();
    expect(grant.scopes).toEqual([]);
    expect(grant.handle).toBeNull();
  });

  it('reads a blank refresh token or handle as none', () => {
    const grant = HostGrant.of({
      accessToken: 'xoxb-1',
      refreshToken: '  ',
      handle: '',
    });

    expect(grant.refreshToken).toBeNull();
    expect(grant.handle).toBeNull();
  });

  it('refuses a grant with no token to act with', () => {
    expect(() => HostGrant.of({ accessToken: '  ' })).toThrow(
      InvalidIdentifierError,
    );
  });
});
