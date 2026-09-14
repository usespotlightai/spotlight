import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import {
  type Bindings,
  holds,
  value,
} from '@infrastructure/integrations/expression';
import type { RequestIR } from '@infrastructure/integrations/integration.compile';
import {
  asJson,
  requiredTextOf,
  requiredValueOf,
  type Templated,
} from '@infrastructure/integrations/templating';
import { Egress } from '@infrastructure/outbound/egress';

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

  async run(request: RequestIR, against: Bindings): Promise<OutboundResult> {
    const reply = await this.send(request, against);

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

  async bytes(request: RequestIR, against: Bindings): Promise<Uint8Array> {
    const reply = await this.send(request, against);

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
    this.authorize(request, against, headers);

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

    return this.fetch(target, {
      method: request.method,
      headers,
      body: body?.text,
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

  private authorize(
    request: RequestIR,
    against: Bindings,
    headers: Record<string, string>,
  ): void {
    const auth = request.auth;

    if (!auth) {
      return;
    }

    const secrets = (against.secret ?? {}) as Record<string, string>;

    if (auth.kind === 'oauth2') {
      const token = against.connection;
      if (typeof token === 'string' && token !== '') {
        headers.authorization = `Bearer ${token}`;
      }
      return;
    }

    if (auth.kind === 'token') {
      const token = secrets[auth.secret];
      if (token !== undefined) {
        headers[auth.header ?? 'authorization'] =
          auth.scheme === 'bearer' ? `Bearer ${token}` : token;
      }
      return;
    }

    if (auth.kind === 'basic') {
      const username = this.templated(auth.username, against) ?? '';
      const password = this.templated(auth.password, against) ?? '';
      headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
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
