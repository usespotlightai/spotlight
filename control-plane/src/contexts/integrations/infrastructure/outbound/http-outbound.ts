import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import type {
  AuthIR,
  RequestIR,
} from '@integrations/infrastructure/integrations/integration.compile';
import {
  asJson,
  requiredTextOf,
  requiredValueOf,
  type Templated,
} from '@integrations/infrastructure/integrations/templating';
import { cappedText } from '@integrations/infrastructure/outbound/capped-body';
import {
  type Dressed,
  followed,
  sameHost,
} from '@integrations/infrastructure/outbound/followed-redirects';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import type { Bindings } from '@platform/expressions/bindings';
import { isTrue, value } from '@platform/expressions/readings';
import { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';

export interface OutboundResult {
  readonly ok: boolean;
  readonly status: number;
  readonly response: unknown;
  readonly capture: Record<string, unknown>;
}

export interface PlainRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface Answered {
  readonly ok: boolean;
  readonly status: number;
  readonly response: unknown;
}

type Fetch = typeof globalThis.fetch;

interface Dispatched {
  readonly reply: Response;
  readonly injected: InjectedSecrets;
}

export const MAX_ANSWER_BYTES = 4 * 1024 * 1024;

const connectionOf = (against: Bindings): string | null =>
  typeof against.connection === 'string' && against.connection !== ''
    ? against.connection
    : null;

export class HttpOutbound {
  private readonly policy: OutboundPolicy;

  constructor(
    allowed: readonly string[],
    private readonly fetch: Fetch = globalThis.fetch,
  ) {
    this.policy = new OutboundPolicy(allowed);
  }

  async run(
    request: RequestIR,
    against: Bindings,
    credentials: Credentials,
  ): Promise<OutboundResult> {
    const sent = await this.send(request, against, credentials);

    if (!sent) {
      return { ok: false, status: 0, response: null, capture: {} };
    }

    const { reply, injected } = sent;
    const response = injected.redactedIn(await parse(reply));
    const status = reply.status;
    const beside: Bindings = { ...against, response, status };

    const capture: Record<string, unknown> = {};
    for (const each of request.capture) {
      capture[each.name] = value(each.value, beside);
    }

    return { ok: succeeded(request, beside), status, response, capture };
  }

  async bytes(
    request: RequestIR,
    against: Bindings,
    credentials: Credentials,
  ): Promise<Uint8Array> {
    const sent = await this.send(request, against, credentials);

    if (!sent) {
      throw new UpstreamError(
        'fetching a file',
        'it names nowhere to fetch it from',
      );
    }

    const { reply } = sent;
    const beside: Bindings = {
      ...against,
      status: reply.status,
      headers: Object.fromEntries(reply.headers),
    };

    if (!succeeded(request, beside)) {
      await reply.body?.cancel();

      throw new UpstreamError(
        'fetching a file',
        `the host answered ${reply.status} without it`,
      );
    }

    return new Uint8Array(await reply.arrayBuffer());
  }

  async answer(
    request: PlainRequest,
    auth: AuthIR | null,
    connection: string | null,
    credentials: Credentials,
  ): Promise<Answered> {
    const { reply, injected } = await this.dispatch(
      request,
      auth,
      connection,
      credentials,
    );
    const status = reply.status;

    return {
      ok: status >= 200 && status < 300,
      status,
      response: injected.redactedIn(
        parsed(
          await cappedText(
            reply,
            MAX_ANSWER_BYTES,
            () =>
              new UpstreamError(
                `reading what ${new URL(request.url).host} answered`,
                `it is larger than the ${MAX_ANSWER_BYTES / 1024 / 1024} MB Spotlight reads from a tool`,
              ),
          ),
        ),
      ),
    };
  }

  private async send(
    request: RequestIR,
    against: Bindings,
    credentials: Credentials,
  ): Promise<Dispatched | null> {
    const plain = this.render(request, against);

    return plain
      ? this.dispatch(plain, request.auth, connectionOf(against), credentials)
      : null;
  }

  private render(request: RequestIR, against: Bindings): PlainRequest | null {
    const url = this.templated(request.url, against);

    if (!url) {
      return null;
    }

    const headers: Record<string, string> = {};
    for (const header of request.headers) {
      const read = this.templated(header.value, against);
      if (read !== null) {
        headers[header.name] = read;
      }
    }

    const query = new URLSearchParams();
    for (const each of request.query) {
      const read = this.templated(each.value, against);
      if (read !== null) {
        query.set(each.name, read);
      }
    }
    const target = query.size > 0 ? `${url}?${query.toString()}` : url;

    const body = this.body(request, against);
    if (body?.json && !has(headers, 'content-type')) {
      headers['content-type'] = 'application/json';
    }

    return {
      method: request.method,
      url: target,
      headers,
      ...(body ? { body: body.text } : {}),
    };
  }

  private async dispatch(
    request: PlainRequest,
    auth: AuthIR | null,
    connection: string | null,
    credentials: Credentials,
  ): Promise<Dispatched> {
    let injected = InjectedSecrets.none();

    try {
      const { reply } = await followed(
        this.fetch,
        this.policy,
        request,
        async (hop): Promise<Dressed> => {
          if (!sameHost(hop.url, request.url)) {
            return {
              url: injected.redact(hop.url),
              headers: Object.fromEntries(
                Object.entries(request.headers).filter(
                  ([name]) => name.toLowerCase() !== 'authorization',
                ),
              ),
            };
          }

          const url = new URL(hop.url);
          const headers = { ...request.headers };
          injected = await this.authorize(
            auth,
            connection,
            url,
            headers,
            credentials,
          );

          return { url: url.href, headers };
        },
      );

      return { reply, injected };
    } catch (error) {
      if (injected.isEmpty || error instanceof EgressBlockedError) {
        throw error;
      }

      throw new UpstreamError(
        `reaching ${new URL(request.url).host}`,
        injected.redact(error instanceof Error ? error.message : String(error)),
      );
    }
  }

  private templated(template: Templated, against: Bindings): string | null {
    return requiredTextOf(template, against);
  }

  private body(
    request: RequestIR,
    against: Bindings,
  ): { text: string; json: boolean } | undefined {
    if (!request.body) {
      return undefined;
    }

    const read = requiredValueOf(request.body, against);

    if (read === null || read === undefined) {
      return undefined;
    }

    // If the host does not know that the body is JSON, it reads the body as form data and finds no fields.
    return typeof read === 'string'
      ? { text: read, json: false }
      : { text: asJson(read), json: true };
  }

  private async authorize(
    auth: AuthIR | null,
    connection: string | null,
    url: URL,
    headers: Record<string, string>,
    credentials: Credentials,
  ): Promise<InjectedSecrets> {
    if (auth?.kind === 'oauth2' && connection) {
      headers.authorization = `Bearer ${connection}`;
    }

    if (auth?.kind !== 'secrets') {
      return InjectedSecrets.none();
    }

    const injected = await credentials.injectedFor(url.href, auth.secrets);
    injected.applyTo({ url, headers });

    return injected;
  }
}

const succeeded = (request: RequestIR, beside: Bindings): boolean => {
  const status = beside.status as number;

  return request.expect?.success
    ? isTrue(request.expect.success, beside)
    : request.expect?.status
      ? request.expect.status.includes(status)
      : status >= 200 && status < 300;
};

const has = (headers: Record<string, string>, name: string): boolean =>
  Object.keys(headers).some((key) => key.toLowerCase() === name);

const parse = async (reply: Response): Promise<unknown> =>
  parsed(await reply.text());

const parsed = (body: string): unknown => {
  if (body === '') {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};
