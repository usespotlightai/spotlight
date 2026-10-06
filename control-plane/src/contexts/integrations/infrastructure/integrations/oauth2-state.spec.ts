import { createHash, createHmac } from 'node:crypto';
import { OAuth2State } from '@integrations/infrastructure/integrations/oauth2-state';
import { describe, expect, it } from 'vitest';

const AT = 1_000_000_000_000;

const INTENT = {
  teamId: 'team_1',
  source: 'slack',
  by: 'user_1',
  holder: 'person' as const,
  back: '/w/acme/inbox/task_1',
  nonce: 'n-1',
};

describe('OAuth2State', () => {
  it('carries who is linking which host for which team, with its nonce', () => {
    const state = new OAuth2State('a-secret', () => AT);

    const signed = state.sign(INTENT);

    expect(state.open(signed.token)).toEqual({
      ...INTENT,
      expiresAt: new Date(AT + 10 * 60 * 1000),
    });
    expect(signed.expiresAt).toEqual(new Date(AT + 10 * 60 * 1000));
  });

  it('will not open a token signed with another secret', () => {
    const signed = new OAuth2State('one-secret', () => AT).sign(INTENT);

    expect(
      new OAuth2State('other-secret', () => AT).open(signed.token),
    ).toBeNull();
  });

  it('will not open a tampered token', () => {
    const state = new OAuth2State('a-secret', () => AT);
    const [, mac] = state.sign(INTENT).token.split('.');

    const swapped = `${Buffer.from(
      JSON.stringify({ ...INTENT, teamId: 'team_2', exp: AT + 1000 }),
    ).toString('base64url')}.${mac}`;

    expect(state.open(swapped)).toBeNull();
  });

  it('will not open a token that carries no nonce', () => {
    const state = new OAuth2State('a-secret', () => AT);
    const body = Buffer.from(
      JSON.stringify({
        teamId: 'team_1',
        source: 'slack',
        by: 'user_1',
        exp: AT + 1000,
      }),
    ).toString('base64url');
    const mac = createHmac('sha256', 'a-secret')
      .update(body)
      .digest('base64url');

    expect(state.open(`${body}.${mac}`)).toBeNull();
  });

  it('will not open a token that has gone stale', () => {
    const signed = new OAuth2State('a-secret', () => AT).sign(INTENT);

    const later = new OAuth2State('a-secret', () => AT + 11 * 60 * 1000);

    expect(later.open(signed.token)).toBeNull();
  });

  it('is null for anything that is not a token', () => {
    const state = new OAuth2State('a-secret', () => AT);

    expect(state.open('')).toBeNull();
    expect(state.open('nonsense')).toBeNull();
    expect(state.open('a.b')).toBeNull();
  });

  it('derives the same PKCE verifier for a nonce from its secret alone, and its S256 challenge', () => {
    const state = new OAuth2State('a-secret', () => AT);
    const verifier = state.verifierFor('n-1');

    expect(verifier).toBe(new OAuth2State('a-secret').verifierFor('n-1'));
    expect(verifier).not.toBe(new OAuth2State('other').verifierFor('n-1'));
    expect(verifier).not.toBe(state.verifierFor('n-2'));
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(OAuth2State.challengeOf(verifier)).toBe(
      createHash('sha256').update(verifier).digest('base64url'),
    );
  });

  it('will not open a token naming a holder it does not know', () => {
    const body = Buffer.from(
      JSON.stringify({ ...INTENT, holder: 'admin', exp: AT + 1000 }),
    ).toString('base64url');
    const mac = createHmac('sha256', 'a-secret')
      .update(body)
      .digest('base64url');

    expect(
      new OAuth2State('a-secret', () => AT).open(`${body}.${mac}`),
    ).toBeNull();
  });
});
