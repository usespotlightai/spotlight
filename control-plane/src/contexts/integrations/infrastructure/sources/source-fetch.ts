import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import { OutboundRefusedError } from '@integrations/domain/exceptions/outbound-refused.error';
import { cappedText } from '@integrations/infrastructure/outbound/capped-body';
import {
  followed,
  type Hop,
} from '@integrations/infrastructure/outbound/followed-redirects';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { DescriptionUnreadable } from '@integrations/infrastructure/sources/operation-record';

type Fetch = typeof globalThis.fetch;

export const READ_AT_MOST_BYTES = 64 * 1024 * 1024;

export const READ_WITHIN_MS = 30_000;

export interface SourceRequest {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly accept: string;
  readonly body?: string;
}

export interface SourceWearing {
  readonly apiHost: string | null;
  readonly secrets: readonly string[];
  readonly connection: string | null;
  readonly credentials: Credentials;
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

  async text(request: SourceRequest, wearing: SourceWearing): Promise<string> {
    const signal = AbortSignal.timeout(READ_WITHIN_MS);

    try {
      const { reply, url } = await followed(
        this.fetch,
        this.policy,
        request,
        (hop) => this.headers(hop, request, wearing),
        signal,
      );

      if (!reply.ok) {
        await reply.body?.cancel();
        throw new DescriptionUnreadable(
          `could not be read: ${hostOf(url)} answered ${reply.status}`,
        );
      }

      return await cappedText(
        reply,
        READ_AT_MOST_BYTES,
        () =>
          new DescriptionUnreadable(
            `is larger than the ${READ_AT_MOST_BYTES / 1024 / 1024} MB Spotlight reads`,
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
        `could not be read: ${hostOf(request.url)}: ${codeOf(error)}`,
      );
    }
  }

  private async headers(
    hop: Hop,
    request: SourceRequest,
    wearing: SourceWearing,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = { accept: request.accept };

    if (hop.body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    if (hostOf(hop.url) !== wearing.apiHost) {
      return headers;
    }

    if (wearing.connection) {
      headers.authorization = `Bearer ${wearing.connection}`;
    }

    if (wearing.secrets.length > 0) {
      (await wearing.credentials.wornToward(hop.url, wearing.secrets)).applyTo(
        headers,
      );
    }

    return headers;
  }
}
