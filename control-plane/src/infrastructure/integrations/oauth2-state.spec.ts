import { OAuth2State } from '@infrastructure/integrations/oauth2-state';
import { describe, expect, it } from 'vitest';

const AT = 1_000_000_000_000;

describe('OAuth2State', () => {
  it('carries who is linking which host for which team', () => {
    const state = new OAuth2State('a-secret', () => AT);

    const token = state.sign({
      teamId: 'team_1',
      source: 'slack',
      by: 'user_1',
    });

    expect(state.open(token)).toEqual({
      teamId: 'team_1',
      source: 'slack',
      by: 'user_1',
    });
  });

  it('will not open a token signed with another secret', () => {
    const signed = new OAuth2State('one-secret', () => AT).sign({
      teamId: 'team_1',
      source: 'slack',
      by: 'user_1',
    });

    expect(new OAuth2State('other-secret', () => AT).open(signed)).toBeNull();
  });

  it('will not open a tampered token', () => {
    const state = new OAuth2State('a-secret', () => AT);
    const token = state.sign({
      teamId: 'team_1',
      source: 'slack',
      by: 'user_1',
    });

    const [body, mac] = token.split('.');
    const swapped = `${Buffer.from(
      JSON.stringify({ teamId: 'team_2', source: 'slack', exp: AT + 1000 }),
    ).toString('base64url')}.${mac}`;
    void body;

    expect(state.open(swapped)).toBeNull();
  });

  it('will not open a token that has gone stale', () => {
    const token = new OAuth2State('a-secret', () => AT).sign({
      teamId: 'team_1',
      source: 'slack',
      by: 'user_1',
    });

    const later = new OAuth2State('a-secret', () => AT + 11 * 60 * 1000);

    expect(later.open(token)).toBeNull();
  });

  it('is null for anything that is not a token', () => {
    const state = new OAuth2State('a-secret', () => AT);

    expect(state.open('')).toBeNull();
    expect(state.open('nonsense')).toBeNull();
    expect(state.open('a.b')).toBeNull();
  });
});
