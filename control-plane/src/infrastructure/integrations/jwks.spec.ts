import { generateKeyPairSync } from 'node:crypto';
import { JwksCache } from '@infrastructure/integrations/jwks';
import { describe, expect, it, vi } from 'vitest';

const jwk = () => {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
};

const answering = () =>
  vi.fn(async () => new Response(JSON.stringify({ keys: [jwk()] })));

describe('JwksCache', () => {
  it('reads the keys a host publishes, by id', async () => {
    const cache = new JwksCache(1000, answering());

    const keys = await cache.keys('https://issuer/jwks.json');

    expect(keys.has('k1')).toBe(true);
  });

  it('does not fetch again within the cache window', async () => {
    const fetch = answering();
    const cache = new JwksCache(1000, fetch, () => 0);

    await cache.keys('https://issuer/jwks.json');
    await cache.keys('https://issuer/jwks.json');

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches again once the window has passed', async () => {
    const fetch = answering();
    let now = 0;
    const cache = new JwksCache(1000, fetch, () => now);

    await cache.keys('https://issuer/jwks.json');
    now = 2000;
    await cache.keys('https://issuer/jwks.json');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('answers with nothing where the host is unreachable', async () => {
    const cache = new JwksCache(
      1000,
      vi.fn(async () => {
        throw new Error('unreachable');
      }),
    );

    expect((await cache.keys('https://issuer/jwks.json')).size).toBe(0);
  });
});
