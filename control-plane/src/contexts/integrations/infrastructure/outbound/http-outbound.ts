import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { RequestIR } from '@integrations/infrastructure/integrations/integration.compile';
import {
  asJson,
  requiredTextOf,
  requiredValueOf,
  type Templated,
} from '@integrations/infrastructure/integrations/templating';
import { Egress } from '@integrations/infrastructure/outbound/egress';
import type { Bindings } from '@platform/expressions/bindings';
import { holds, value } from '@platform/expressions/readings';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

export interface OutboundResult {
  readonly ok: boolean;
  readonly status: number;
  readonly response: unknown;
  readonly capture: Record<string, unknown>;
}

type Fetch = typeof globalThis.fetch;

export class HttpOutbound {
  private readonly egress: Egress;

  constructor(
    allowed: readonly string[],
    private readonly fetch: Fetch = globalThis.fetch,
  ) {
    this.egress = new Egress(allowed);
  }

  async run(
    request: RequestIR,
    against: Bindings,
    credentials: Credentials,
  ): Promise<OutboundResult> {
    const reply = await this.send(request, against, credentials);

    if (!reply) {
      return { ok: false, status: 0, response: null, capture: {} };
    }

    const response = await parse(reply);
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
    const reply = await this.send(request, against, credentials);

    if (!reply) {
      throw new UpstreamRefusedError(
        'fetching a file',
        'it names nowhere to fetch it from',
      );
    }

    const beside: Bindings = {
      ...against,
      status: reply.status,
      headers: Object.fromEntries(reply.headers),
    };

    if (!succeeded(request, beside)) {
      await reply.body?.cancel();

      throw new UpstreamRefusedError(
        'fetching a file',
        `the host answered ${reply.status} without it`,
      );
    }

    return new Uint8Array(await reply.arrayBuffer());
  }

  private async send(
    request: RequestIR,
    against: Bindings,
    credentials: Credentials,
  ): Promise<Response | null> {
    const url = this.templated(request.url, against);

    if (!url) {
      return null;
    }

    this.egress.allow(url);

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

    const wearsSecrets = await this.authorize(
      request,
      against,
      url,
      headers,
      credentials,
    );

    return this.fetch(target, {
      method: request.method,
      headers,
      body: body?.text,
      redirect: wearsSecrets ? 'manual' : 'follow',
    });
  }

  private templated(held: Templated, against: Bindings): string | null {
    return requiredTextOf(held, against);
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

    // A host not told the body is JSON reads it as form data and finds no fields.
    return typeof read === 'string'
      ? { text: read, json: false }
      : { text: asJson(read), json: true };
  }

  private async authorize(
    request: RequestIR,
    against: Bindings,
    url: string,
    headers: Record<string, string>,
    credentials: Credentials,
  ): Promise<boolean> {
    const auth = request.auth;

    if (auth?.kind === 'oauth2') {
      const token = against.connection;
      if (typeof token === 'string' && token !== '') {
        headers.authorization = `Bearer ${token}`;
      }
      return false;
    }

    if (auth?.kind === 'secrets') {
      (await credentials.wornToward(url, auth.secrets)).applyTo(headers);
      return true;
    }

    return false;
  }
}

const succeeded = (request: RequestIR, beside: Bindings): boolean => {
  const status = beside.status as number;

  return request.expect?.success
    ? holds(request.expect.success, beside)
    : request.expect?.status
      ? request.expect.status.includes(status)
      : status >= 200 && status < 300;
};

const has = (headers: Record<string, string>, name: string): boolean =>
  Object.keys(headers).some((key) => key.toLowerCase() === name);

const parse = async (reply: Response): Promise<unknown> => {
  const body = await reply.text();

  if (body === '') {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};
