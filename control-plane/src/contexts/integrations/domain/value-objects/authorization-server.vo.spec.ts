import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { describe, expect, it } from 'vitest';

const SERVER = {
  issuer: 'https://auth.acme.example',
  authorize: 'https://auth.acme.example/authorize',
  token: 'https://auth.acme.example/token',
};

describe('AuthorizationServer', () => {
  it('is the same server only when its issuer and both endpoints are', () => {
    const server = AuthorizationServer.of(SERVER);

    expect(server.equals(AuthorizationServer.of(SERVER))).toBe(true);
    expect(
      server.equals(
        AuthorizationServer.of({
          ...SERVER,
          token: 'https://evil.example/token',
        }),
      ),
    ).toBe(false);
    expect(
      server.equals(
        AuthorizationServer.of({ ...SERVER, issuer: 'https://evil.example' }),
      ),
    ).toBe(false);
  });

  it('rejects an endpoint that is not a web address', () => {
    expect(() =>
      AuthorizationServer.of({ ...SERVER, token: 'file:///etc/passwd' }),
    ).toThrow(/not a web address/);
  });
});
