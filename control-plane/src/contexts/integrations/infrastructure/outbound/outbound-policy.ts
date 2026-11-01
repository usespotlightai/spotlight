import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import {
  OutboundBlockedError,
  type OutboundGuard,
} from '@platform/outbound/outbound-guard';

type Fetch = typeof globalThis.fetch;

const egressBlocked = (error: unknown): unknown =>
  error instanceof OutboundBlockedError
    ? new EgressBlockedError(error.host, error.reason)
    : error;

export class OutboundPolicy {
  readonly fetch: Fetch;

  constructor(private readonly guard: OutboundGuard) {
    this.fetch = (async (url: Parameters<Fetch>[0], init?: RequestInit) => {
      try {
        return await guard.fetch(url, init);
      } catch (error) {
        throw egressBlocked(error);
      }
    }) as Fetch;
  }

  allow(url: string): void {
    let host: string;

    try {
      host = new URL(url).hostname;
    } catch {
      throw new EgressBlockedError(url, 'URL is not valid.');
    }

    if (!host) {
      throw new EgressBlockedError(url, 'URL names no host.');
    }

    try {
      this.guard.check(url);
    } catch (error) {
      throw egressBlocked(error);
    }
  }
}
