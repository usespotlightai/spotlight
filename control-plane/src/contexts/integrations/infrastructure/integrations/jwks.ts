import { createPublicKey, type KeyObject } from 'node:crypto';

export interface JwksResolver {
  keys(url: string): Promise<ReadonlyMap<string, KeyObject>>;
}

type Fetch = typeof globalThis.fetch;

interface Held {
  readonly at: number;
  readonly keys: ReadonlyMap<string, KeyObject>;
}

export class JwksCache implements JwksResolver {
  private readonly held = new Map<string, Held>();

  constructor(
    private readonly ttl = 3_600_000,
    private readonly fetch: Fetch = globalThis.fetch,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async keys(url: string): Promise<ReadonlyMap<string, KeyObject>> {
    const hit = this.held.get(url);

    if (hit && this.now() - hit.at < this.ttl) {
      return hit.keys;
    }

    const keys = await this.read(url);
    this.held.set(url, { at: this.now(), keys });

    return keys;
  }

  private async read(url: string): Promise<ReadonlyMap<string, KeyObject>> {
    const keys = new Map<string, KeyObject>();
    const reply = await this.fetch(url);

    if (!reply.ok) {
      throw new Error(`${url} answered ${reply.status} for its signing keys`);
    }

    const body = (await reply.json()) as { keys?: Jwk[] };

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
