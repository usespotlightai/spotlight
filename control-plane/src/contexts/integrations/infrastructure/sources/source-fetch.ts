import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import { OutboundRefusedError } from '@integrations/domain/exceptions/outbound-refused.error';
import { cappedText } from '@integrations/infrastructure/outbound/capped-body';
import {
  type Dressed,
  followed,
  type Hop,
} from '@integrations/infrastructure/outbound/followed-redirects';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { DescriptionUnreadable } from '@integrations/infrastructure/sources/operation-record';
import { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';

type Fetch = typeof globalThis.fetch;

export const MAX_READ_BYTES = 64 * 1024 * 1024;

export const READ_WITHIN_MS = 30_000;

export interface SourceRequest {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly accept: string;
  readonly body?: string;
}

export interface SourceInjection {
  readonly apiHost: string | null;
  readonly secrets: readonly string[];
  readonly connection: string | null;
  readonly credentials: Credentials;
}

const UNAUTHORIZED = 401;

export class DescriptionUnauthorized extends DescriptionUnreadable {
  constructor(because: string) {
    super(because);
    this.name = 'DescriptionUnauthorized';
  }
}

const hostOf = (url: string): string => new URL(url).host.toLowerCase();

const codeOf = (error: unknown): string => {
  const cause = (error as { cause?: unknown } | null)?.cause ?? error;
  const code = (cause as { code?: unknown } | null)?.code;

  return typeof code === 'string'
    ? code
    : cause instanceof Error
      ? cause.message
      : String(cause);
};

export class SourceFetch {
  constructor(
    private readonly policy: OutboundPolicy,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  async text(
    request: SourceRequest,
    injection: SourceInjection,
  ): Promise<string> {
    const signal = AbortSignal.timeout(READ_WITHIN_MS);
    let injected = InjectedSecrets.none();

    try {
      const { reply, url } = await followed(
        this.fetch,
        this.policy,
        request,
        async (hop) => {
          const dressed = await this.dressed(hop, request, injection);

          if (dressed.injected.isEmpty) {
            return { ...dressed, url: injected.redact(dressed.url) };
          }

          injected = dressed.injected;

          return dressed;
        },
        signal,
      );

      if (!reply.ok) {
        await reply.body?.cancel();
        const because = `could not be read: ${hostOf(url)} answered ${reply.status}`;

        throw reply.status === UNAUTHORIZED
          ? new DescriptionUnauthorized(because)
          : new DescriptionUnreadable(because);
      }

      return await cappedText(
        reply,
        MAX_READ_BYTES,
        () =>
          new DescriptionUnreadable(
            `is larger than the ${MAX_READ_BYTES / 1024 / 1024} MB Spotlight reads`,
          ),
      );
    } catch (error) {
      if (signal.aborted) {
        throw new DescriptionUnreadable(
          `took longer than ${READ_WITHIN_MS / 1000} seconds to read`,
        );
      }

      if (
        error instanceof DescriptionUnreadable ||
        error instanceof OutboundRefusedError
      ) {
        throw error;
      }

      throw new DescriptionUnreadable(
        `could not be read: ${hostOf(request.url)}: ${injected.redact(codeOf(error))}`,
      );
    }
  }

  private async dressed(
    hop: Hop,
    request: SourceRequest,
    injection: SourceInjection,
  ): Promise<Dressed & { readonly injected: InjectedSecrets }> {
    const url = new URL(hop.url);
    const headers: Record<string, string> = { accept: request.accept };

    if (hop.body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    if (hostOf(hop.url) !== injection.apiHost) {
      return { url: url.href, headers, injected: InjectedSecrets.none() };
    }

    if (injection.connection) {
      headers.authorization = `Bearer ${injection.connection}`;
    }

    const injected =
      injection.secrets.length > 0
        ? await injection.credentials.injectedFor(hop.url, injection.secrets)
        : InjectedSecrets.none();
    injected.applyTo({ url, headers });

    return { url: url.href, headers, injected };
  }
}
