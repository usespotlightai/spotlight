import { generateKeyPairSync } from 'node:crypto';
import { JoseHookTokens } from '@integrations/infrastructure/hooks/jose-hook-tokens';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';

const pemOf = (curve: string) =>
  generateKeyPairSync('ec', { namedCurve: curve })
    .privateKey.export({ type: 'pkcs8', format: 'pem' })
    .toString();

const ISSUER = 'https://spotlight.example.com/api';

describe('JoseHookTokens', () => {
  it('signs short-lived tokens an endpoint checks against the published keys', async () => {
    const tokens = new JoseHookTokens(pemOf('prime256v1'), ISSUER);
    const token = await tokens.signed({
      audience: 'https://dba.example.com',
      subject: 'hook:workspace_1/team_1/dba-review',
      occurrence: 'occurrence_1',
      message: 'msg_1',
      bodyDigest: 'digest',
    });

    const { payload, protectedHeader } = await jwtVerify(
      token,
      createLocalJWKSet((await tokens.keys()) as never),
      { issuer: ISSUER, audience: 'https://dba.example.com' },
    );

    expect(protectedHeader.alg).toBe('ES256');
    expect(payload).toMatchObject({
      sub: 'hook:workspace_1/team_1/dba-review',
      webhook_id: 'msg_1',
      body_sha256: 'digest',
    });
    expect((payload.exp as number) - (payload.iat as number)).toBe(300);
  });

  it('publishes only the public half of its key', async () => {
    const tokens = new JoseHookTokens(pemOf('prime256v1'), ISSUER);
    const [key] = (await tokens.keys()).keys;

    expect(key).toMatchObject({
      kty: 'EC',
      crv: 'P-256',
      alg: 'ES256',
      use: 'sig',
    });
    expect(key).not.toHaveProperty('d');
  });

  it('refuses at start a key that is not P-256, rather than failing each call', () => {
    expect(() => new JoseHookTokens(pemOf('secp384r1'), ISSUER)).toThrow(
      /not a P-256 private key/,
    );
  });

  it('signs nothing and publishes no keys without a key', async () => {
    const tokens = new JoseHookTokens(undefined, ISSUER);

    expect(tokens.signs).toBe(false);
    await expect(tokens.keys()).resolves.toEqual({ keys: [] });
  });
});
