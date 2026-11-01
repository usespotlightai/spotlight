import { generateKeyPairSync } from 'node:crypto';
import { JwksCache } from '@integrations/infrastructure/integrations/jwks';
import { allowingOutbound } from '@integrations/infrastructure/outbound/outbound-policy.fake-spec';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { describe, expect, it, vi } from 'vitest';

const jwk = () => {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
};

const answering = () =>
  vi.fn(async () => new Response(JSON.stringify({ keys: [jwk()] })));

describe('JwksCache', () => {
  it('reads the keys a host publishes, by id', async () => {
    const cache = new JwksCache(allowingOutbound([]), 1000, answering());

    const keys = await cache.keys('https://issuer/jwks.json');

    expect(keys.has('k1')).toBe(true);
  });

  it('does not fetch again within the cache window', async () => {
    const fetch = answering();
    const cache = new JwksCache(allowingOutbound([]), 1000, fetch, () => 0);

    await cache.keys('https://issuer/jwks.json');
    await cache.keys('https://issuer/jwks.json');

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses its cached keys to a workspace that may not call the host', async () => {
    const cache = new JwksCache(
      allowingOutbound([]),
      1000,
      answering(),
      () => 0,
    );

    await cache.keys('https://issuer.example/jwks.json');

    await expect(
      OutboundScope.within(HostAllowList.of(['elsewhere.example']), () =>
        cache.keys('https://issuer.example/jwks.json'),
      ),
    ).rejects.toThrow("Host is not on the workspace's allowed list.");
  });

  it('fetches again once the window has passed', async () => {
    const fetch = answering();
    let now = 0;
    const cache = new JwksCache(allowingOutbound([]), 1000, fetch, () => now);

    await cache.keys('https://issuer/jwks.json');
    now = 2000;
    await cache.keys('https://issuer/jwks.json');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails where the host is unreachable, and requests again next time', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error('unreachable'))
      .mockImplementation(answering());
    const cache = new JwksCache(allowingOutbound([]), 1000, fetch, () => 0);

    await expect(cache.keys('https://issuer/jwks.json')).rejects.toThrow(
      'unreachable',
    );
    expect((await cache.keys('https://issuer/jwks.json')).has('k1')).toBe(true);
  });

  it('fails where the host answers with an error', async () => {
    const cache = new JwksCache(
      allowingOutbound([]),
      1000,
      vi.fn(async () => new Response('down', { status: 503 })),
    );

    await expect(cache.keys('https://issuer/jwks.json')).rejects.toThrow('503');
  });
});
