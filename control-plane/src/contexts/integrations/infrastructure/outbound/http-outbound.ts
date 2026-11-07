import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
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
import {
  cappedReply,
  cappedText,
} from '@integrations/infrastructure/outbound/capped-body';
import { EgressBlockedError } from '@integrations/application/errors/egress-blocked.error';
import {
  type Dressed,
  followed,
  sameHost,
} from '@integrations/infrastructure/outbound/followed-redirects';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import {
  applyInjected,
  redactInjected,
  redactInjectedIn,
} from '@integrations/infrastructure/outbound/secret-injection';
import type { CelVariables } from '@platform/expressions/cel-variables';
import { isTrue, value } from '@platform/expressions/readings';
import { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';

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

interface Sendable extends Omit<PlainRequest, 'body'> {
  readonly body?: string | Uint8Array<ArrayBuffer>;
}

export interface SentFile {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly type: string;
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

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const connectionOf = (against: CelVariables): string | null =>
  typeof against.connection === 'string' && against.connection !== ''
    ? against.connection
    : null;

export class HttpOutbound {
  constructor(
    private readonly policy: OutboundPolicy,
    private readonly fetch: Fetch = policy.fetch,
  ) {}

  async run(
    request: RequestIR,
    against: CelVariables,
    credentials: Credentials,
  ): Promise<OutboundResult> {
    const sent = await this.send(request, against, credentials);

    if (!sent) {
      return { ok: false, status: 0, response: null, capture: {} };
    }

    const { reply, injected } = sent;

    return answeredWith(
      request,
      against,
      reply.status,
      redactInjectedIn(injected, await parse(reply)),
    );
  }

  async upload(
    request: RequestIR,
    against: CelVariables,
    credentials: Credentials,
    file: SentFile,
  ): Promise<OutboundResult> {
    const plain = this.rendered(request, against);

    if (!plain) {
      return { ok: false, status: 0, response: null, capture: {} };
    }

    const { reply, injected } = await this.dispatch(
      {
        ...plain,
        headers: has(plain.headers, 'content-type')
          ? plain.headers
          : { ...plain.headers, 'content-type': file.type },
        body: file.bytes,
      },
      request.auth,
      connectionOf(against),
      credentials,
    );

    return answeredWith(
      request,
      against,
      reply.status,
      redactInjectedIn(injected, await parse(reply)),
    );
  }

  async bytes(
    request: RequestIR,
    against: CelVariables,
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
    const beside: CelVariables = {
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

    const capped = cappedReply(
      reply,
      MAX_FILE_BYTES,
      () =>
        new UpstreamError(
          'fetching a file',
          `it is larger than the ${MAX_FILE_BYTES / 1024 / 1024} MB Spotlight keeps of a file`,
        ),
    );

    return new Uint8Array(await capped.arrayBuffer());
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
      response: redactInjectedIn(
        injected,
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
    against: CelVariables,
    credentials: Credentials,
  ): Promise<Dispatched | null> {
    const plain = this.rendered(request, against);

    return plain
      ? this.dispatch(plain, request.auth, connectionOf(against), credentials)
      : null;
  }

  rendered(request: RequestIR, against: CelVariables): PlainRequest | null {
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
    request: Sendable,
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
              url: redactInjected(injected, hop.url),
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
        redactInjected(
          injected,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  private templated(template: Templated, against: CelVariables): string | null {
    return requiredTextOf(template, against);
  }

  private body(
    request: RequestIR,
    against: CelVariables,
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
    applyInjected(injected, { url, headers });

    return injected;
  }
}

export const answeredWith = (
  request: RequestIR,
  against: CelVariables,
  status: number,
  response: unknown,
): OutboundResult => {
  const beside: CelVariables = { ...against, response, status };

  const capture: Record<string, unknown> = {};
  for (const each of request.capture) {
    capture[each.name] = value(each.value, beside);
  }

  return { ok: succeeded(request, beside), status, response, capture };
};

const succeeded = (request: RequestIR, beside: CelVariables): boolean => {
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
  parsed(
    await cappedText(
      reply,
      MAX_ANSWER_BYTES,
      () =>
        new UpstreamError(
          'reading an answer',
          `it is larger than the ${MAX_ANSWER_BYTES / 1024 / 1024} MB Spotlight reads from a call`,
        ),
    ),
  );

export const parsed = (body: string): unknown => {
  if (body === '') {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};
