import { createPublicKey, type KeyObject } from 'node:crypto';

import { cappedText } from '@integrations/infrastructure/outbound/capped-body';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { fieldOf } from '@platform/json/field-of';

export interface JwksResolver {
  keys(url: string): Promise<ReadonlyMap<string, KeyObject>>;
}

type Fetch = typeof globalThis.fetch;

const READ_WITHIN_MS = 15_000;

const MAX_KEYS_BYTES = 1024 * 1024;

interface CachedKeys {
  readonly at: number;
  readonly keys: ReadonlyMap<string, KeyObject>;
}

export class JwksCache implements JwksResolver {
  private readonly cache = new Map<string, CachedKeys>();

  constructor(
    private readonly policy: OutboundPolicy,
    private readonly ttl = 3_600_000,
    private readonly fetch: Fetch = policy.fetch,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async keys(url: string): Promise<ReadonlyMap<string, KeyObject>> {
    const hit = this.cache.get(url);

    if (hit && this.now() - hit.at < this.ttl) {
      this.policy.allow(url);
      return hit.keys;
    }

    const keys = await this.read(url);
    this.cache.set(url, { at: this.now(), keys });

    return keys;
  }

  private async read(url: string): Promise<ReadonlyMap<string, KeyObject>> {
    const keys = new Map<string, KeyObject>();
    this.policy.allow(url);
    const reply = await this.fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(READ_WITHIN_MS),
    });

    if (!reply.ok) {
      throw new Error(`${url} answered ${reply.status} for its signing keys`);
    }

    const body: unknown = JSON.parse(
      await cappedText(
        reply,
        MAX_KEYS_BYTES,
        () => new Error(`${url} answered more than 1 MiB of signing keys`),
      ),
    );
    const listed = fieldOf(body, 'keys');
    const jwks: readonly unknown[] = Array.isArray(listed) ? listed : [];

    for (const jwk of jwks) {
      if (!isKeyed(jwk)) {
        continue;
      }

      try {
        keys.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
      } catch {}
    }

    return keys;
  }
}

const isKeyed = (jwk: unknown): jwk is JsonWebKey & { readonly kid: string } =>
  typeof jwk === 'object' &&
  jwk !== null &&
  'kid' in jwk &&
  typeof jwk.kid === 'string' &&
  jwk.kid !== '';
