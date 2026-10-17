import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';

type Fetch = typeof globalThis.fetch;

const MAX_REDIRECTS = 5;

const REDIRECTS = [301, 302, 303, 307, 308];

const PRESERVES_METHOD = [307, 308];

export interface Hop {
  readonly method: string;
  readonly url: string;
  readonly body?: string;
}

export interface Dressed {
  readonly url: string;
  readonly headers: Record<string, string>;
}

export const followed = async (
  fetch: Fetch,
  policy: OutboundPolicy,
  first: Hop,
  dressed: (hop: Hop) => Promise<Dressed>,
  signal?: AbortSignal,
): Promise<{ readonly reply: Response; readonly url: string }> => {
  let hop = first;

  for (let followed = 0; followed <= MAX_REDIRECTS; followed += 1) {
    policy.allow(hop.url);

    const sending = await dressed(hop);
    const reply = await fetch(sending.url, {
      method: hop.method,
      headers: sending.headers,
      body: hop.body,
      redirect: 'manual',
      signal,
    });
    const location = reply.headers.get('location');

    if (!REDIRECTS.includes(reply.status) || !location) {
      return { reply, url: hop.url };
    }

    await reply.body?.cancel();

    const next = new URL(location, hop.url);

    if (new URL(hop.url).protocol === 'https:' && next.protocol !== 'https:') {
      throw new EgressBlockedError(
        next.host.toLowerCase(),
        'is where an https request was redirected to over plain http, which Spotlight does not follow',
      );
    }

    hop = PRESERVES_METHOD.includes(reply.status)
      ? { ...hop, url: next.href }
      : { method: 'GET', url: next.href };
  }

  throw new EgressBlockedError(
    new URL(hop.url).host.toLowerCase(),
    `redirected more than ${MAX_REDIRECTS} times`,
  );
};

export const sameHost = (one: string, other: string): boolean =>
  new URL(one).host.toLowerCase() === new URL(other).host.toLowerCase();
