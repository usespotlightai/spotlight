import { OutboundRefusedError } from '@integrations/domain/exceptions/outbound-refused.error';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';

type Fetch = typeof globalThis.fetch;

const REDIRECTS_AT_MOST = 5;

const REDIRECTS = [301, 302, 303, 307, 308];

const KEEPS_ITS_METHOD = [307, 308];

export interface Hop {
  readonly method: string;
  readonly url: string;
  readonly body?: string;
}

export const followed = async (
  fetch: Fetch,
  policy: OutboundPolicy,
  first: Hop,
  headersFor: (hop: Hop) => Promise<Record<string, string>>,
  signal?: AbortSignal,
): Promise<{ readonly reply: Response; readonly url: string }> => {
  let hop = first;

  for (let followed = 0; followed <= REDIRECTS_AT_MOST; followed += 1) {
    policy.allow(hop.url);

    const reply = await fetch(hop.url, {
      method: hop.method,
      headers: await headersFor(hop),
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
      throw new OutboundRefusedError(
        next.host.toLowerCase(),
        'is where an https request was redirected to over plain http, which Spotlight does not follow',
      );
    }

    hop = KEEPS_ITS_METHOD.includes(reply.status)
      ? { ...hop, url: next.href }
      : { method: 'GET', url: next.href };
  }

  throw new OutboundRefusedError(
    new URL(hop.url).host.toLowerCase(),
    `redirected more than ${REDIRECTS_AT_MOST} times`,
  );
};

export const sameHost = (one: string, other: string): boolean =>
  new URL(one).host.toLowerCase() === new URL(other).host.toLowerCase();
