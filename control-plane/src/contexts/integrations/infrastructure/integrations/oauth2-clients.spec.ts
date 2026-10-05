import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import { describe, expect, it } from 'vitest';

describe('OAuth2Clients', () => {
  it('reads a source’s app from the deployment map', () => {
    const clients = OAuth2Clients.from('{"slack":{"id":"c-1","secret":"s-1"}}');

    expect(clients.of('slack')).toEqual({
      id: 'c-1',
      secret: 's-1',
      issuer: null,
    });
  });

  it('has nothing for a host the deployment did not register', () => {
    const clients = OAuth2Clients.from('{"slack":{"id":"c-1","secret":"s-1"}}');

    expect(clients.of('linear')).toBeNull();
  });

  it('reads an empty map from an empty value', () => {
    expect(OAuth2Clients.from('').of('slack')).toBeNull();
    expect(OAuth2Clients.from('{}').of('slack')).toBeNull();
  });

  it('refuses a value that is not JSON', () => {
    expect(() => OAuth2Clients.from('not json')).toThrow(/OAUTH_CLIENTS/);
  });

  it('refuses an app missing its id or secret', () => {
    expect(() => OAuth2Clients.from('{"slack":{"id":"c-1"}}')).toThrow(
      /id, secret/,
    );
  });
});
