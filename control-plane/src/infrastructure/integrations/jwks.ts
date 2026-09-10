import { createPublicKey, type KeyObject } from 'node:crypto';

/**
 * The public keys a host publishes, by key id, for verifying a JWT it signed.
 * Fetched from the host and cached: a JWKS turns over rarely, and a delivery
 * must not wait on a network round trip it made a moment ago.
 */
export interface JwksResolver {
  keys(url: string): Promise<ReadonlyMap<string, KeyObject>>;
}

type Fetch = typeof globalThis.fetch;

interface Held {
  readonly at: number;
  readonly keys: ReadonlyMap<string, KeyObject>;
}

/** A JWKS a host answered with, kept for a while so most deliveries need none. */
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

    try {
      const reply = await this.fetch(url);
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
        } catch {
          // A key that will not read is one Spotlight cannot verify by, which
          // is a delivery refused, not a source that breaks.
        }
      }
    } catch {
      // An unreachable JWKS leaves nothing to verify by, so verification fails
      // closed until the host is reachable again.
    }

    return keys;
  }
}

interface Jwk {
  readonly kid?: string;
  readonly [key: string]: unknown;
}
