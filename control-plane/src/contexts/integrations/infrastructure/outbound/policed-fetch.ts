import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import {
  type Dressed,
  followed,
  type Hop,
} from '@integrations/infrastructure/outbound/followed-redirects';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import {
  InjectedSecrets,
  type InjectionRequest,
} from '@secrets/application/contracts/injected-secrets.contract';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';

type Fetch = typeof globalThis.fetch;

export type PolicedFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type Injecting = (
  hop: Hop,
  request: InjectionRequest,
) => Promise<InjectedSecrets>;

const bodyOf = (body: RequestInit['body']): string | undefined =>
  body === undefined || body === null ? undefined : String(body);

export const policedFetch =
  (
    fetch: Fetch,
    policy: OutboundPolicy,
    inject: Injecting = async () => InjectedSecrets.none(),
  ): PolicedFetch =>
  async (url, init) => {
    const headers = Object.fromEntries(new Headers(init?.headers));
    let injected = InjectedSecrets.none();

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
          const request = { url: new URL(hop.url), headers: { ...headers } };
          const injectedNow = await inject(hop, request);

          if (injectedNow.isEmpty) {
            return {
              url: injected.redact(request.url.href),
              headers: request.headers,
            };
          }

          injected = injectedNow;

          return { url: request.url.href, headers: request.headers };
        },
        init?.signal ?? undefined,
      );

      return reply;
    } catch (error) {
      if (injected.isEmpty || error instanceof EgressBlockedError) {
        throw error;
      }

      throw new UpstreamError(
        `reaching ${new URL(url.toString()).host}`,
        injected.redact(error instanceof Error ? error.message : String(error)),
      );
    }
  };
