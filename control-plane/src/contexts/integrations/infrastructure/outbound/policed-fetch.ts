import {
  followed,
  type Hop,
} from '@integrations/infrastructure/outbound/followed-redirects';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';

type Fetch = typeof globalThis.fetch;

export type PolicedFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type Wearing = (
  hop: Hop,
  headers: Record<string, string>,
) => Promise<void>;

const bodyOf = (body: RequestInit['body']): string | undefined =>
  body === undefined || body === null ? undefined : String(body);

export const policedFetch =
  (
    fetch: Fetch,
    policy: OutboundPolicy,
    wearing: Wearing = async () => {},
  ): PolicedFetch =>
  async (url, init) => {
    const given = Object.fromEntries(new Headers(init?.headers));
    const { reply } = await followed(
      fetch,
      policy,
      {
        method: init?.method ?? 'GET',
        url: url.toString(),
        body: bodyOf(init?.body),
      },
      async (hop) => {
        const headers = { ...given };

        await wearing(hop, headers);

        return headers;
      },
      init?.signal ?? undefined,
    );

    return reply;
  };
