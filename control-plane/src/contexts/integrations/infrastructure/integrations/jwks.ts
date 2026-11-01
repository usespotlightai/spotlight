import { createPublicKey, type KeyObject } from 'node:crypto';
import { cappedText } from '@integrations/infrastructure/outbound/capped-body';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';

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

    const body = JSON.parse(
      await cappedText(
        reply,
        MAX_KEYS_BYTES,
        () => new Error(`${url} answered more than 1 MiB of signing keys`),
      ),
    ) as { keys?: Jwk[] };

    for (const jwk of body.keys ?? []) {
      if (!jwk.kid) {
        continue;
      }

      try {
        keys.set(
          jwk.kid,
          createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' }),
        );
      } catch {}
    }

    return keys;
  }
}

interface Jwk {
  readonly kid?: string;
  readonly [key: string]: unknown;
}
