import { OutboundRefusedError } from '@integrations/domain/exceptions/outbound-refused.error';
import {
  type Dressed,
  followed,
  type Hop,
} from '@integrations/infrastructure/outbound/followed-redirects';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import {
  type WornRequest,
  WornSecrets,
} from '@secrets/application/contracts/worn-secrets.contract';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

type Fetch = typeof globalThis.fetch;

export type PolicedFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type Wearing = (hop: Hop, request: WornRequest) => Promise<WornSecrets>;

const bodyOf = (body: RequestInit['body']): string | undefined =>
  body === undefined || body === null ? undefined : String(body);

export const policedFetch =
  (
    fetch: Fetch,
    policy: OutboundPolicy,
    wearing: Wearing = async () => WornSecrets.none(),
  ): PolicedFetch =>
  async (url, init) => {
    const given = Object.fromEntries(new Headers(init?.headers));
    let worn = WornSecrets.none();

    try {
      const { reply } = await followed(
        fetch,
        policy,
        {
          method: init?.method ?? 'GET',
          url: url.toString(),
          body: bodyOf(init?.body),
        },
        async (hop): Promise<Dressed> => {
          const request = { url: new URL(hop.url), headers: { ...given } };
          const wearingNow = await wearing(hop, request);

          if (wearingNow.isEmpty) {
            return {
              url: worn.redact(request.url.href),
              headers: request.headers,
            };
          }

          worn = wearingNow;

          return { url: request.url.href, headers: request.headers };
        },
        init?.signal ?? undefined,
      );

      return reply;
    } catch (error) {
      if (worn.isEmpty || error instanceof OutboundRefusedError) {
        throw error;
      }

      throw new UpstreamRefusedError(
        `reaching ${new URL(url.toString()).host}`,
        worn.redact(error instanceof Error ? error.message : String(error)),
      );
    }
  };
