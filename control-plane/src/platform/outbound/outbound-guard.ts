import { type LookupAddress, lookup } from 'node:dns';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { OutboundHosts } from '@platform/outbound/outbound-hosts';
import { isAddress, unreachable } from '@platform/outbound/reachable-addresses';
import { Agent, buildConnector } from 'undici';

type Fetch = typeof globalThis.fetch;

const CONNECT_WITHIN_MS = 10_000;
const HEADERS_WITHIN_MS = 120_000;
const IDLE_BODY_MS = 120_000;

export class OutboundBlockedError extends Error {
  constructor(
    readonly host: string,
    readonly reason: string,
  ) {
    super(`${host}: ${reason}`);
    this.name = 'OutboundBlockedError';
  }
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

export class OutboundGuard implements OnApplicationShutdown {
  readonly fetch: Fetch;
  private readonly agent: Agent;

  constructor(
    private readonly hosts: OutboundHosts,
    private readonly loopbackAllowed = false,
  ) {
    const connector = buildConnector({
      timeout: CONNECT_WITHIN_MS,
      lookup: (
        hostname: string,
        options: { all?: boolean },
        done: LookupCallback,
      ) => this.resolved(hostname, options, done),
    } as buildConnector.BuildOptions);

    const agent = new Agent({
      headersTimeout: HEADERS_WITHIN_MS,
      bodyTimeout: IDLE_BODY_MS,
      connect: (options, done) => {
        const refused = this.refusal(options.hostname);

        if (refused) {
          done(refused, null);
          return;
        }

        connector(options, done);
      },
    });
    this.agent = agent;

    this.fetch = (async (url: Parameters<Fetch>[0], init?: RequestInit) => {
      try {
        return await globalThis.fetch(url, {
          ...init,
          dispatcher: agent,
        } as RequestInit);
      } catch (error) {
        throw blockedIn(error) ?? error;
      }
    }) as unknown as Fetch;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.agent.close();
  }

  check(url: string): void {
    const refused = this.unlisted(new URL(url).hostname);

    if (refused) {
      throw refused;
    }
  }

  private unlisted(hostname: string): OutboundBlockedError | null {
    const host = hostname.toLowerCase();

    return this.hosts.allows(host)
      ? null
      : new OutboundBlockedError(host, 'Host is not on the allowed list.');
  }

  private refusal(hostname: string): OutboundBlockedError | null {
    const host = hostname.toLowerCase();
    const unlisted = this.unlisted(host);

    if (unlisted) {
      return unlisted;
    }

    if (isAddress(host)) {
      const reason = unreachable(
        host,
        this.hosts.named(host),
        this.loopbackAllowed,
      );

      return reason
        ? new OutboundBlockedError(host, `The address ${reason}`)
        : null;
    }

    return null;
  }

  private resolved(
    hostname: string,
    options: { all?: boolean },
    done: LookupCallback,
  ): void {
    lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        done(error, []);
        return;
      }

      const named = this.hosts.named(hostname);

      for (const each of addresses) {
        const reason = unreachable(each.address, named, this.loopbackAllowed);

        if (reason) {
          done(
            new OutboundBlockedError(
              hostname.toLowerCase(),
              `The host resolves to ${each.address}, which ${reason}`,
            ),
            [],
          );
          return;
        }
      }

      const [first] = addresses;

      if (options.all) {
        done(null, addresses);
      } else if (first) {
        done(null, first.address, first.family);
      } else {
        done(
          Object.assign(new Error(`${hostname} resolves to nothing`), {
            code: 'ENOTFOUND',
          }),
          [],
        );
      }
    });
  }
}

const blockedIn = (error: unknown): OutboundBlockedError | null => {
  for (
    let at: unknown = error;
    at instanceof Error;
    at = (at as { cause?: unknown }).cause
  ) {
    if (at instanceof OutboundBlockedError) {
      return at;
    }
  }

  return null;
};
