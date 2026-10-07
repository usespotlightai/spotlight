import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import {
  DescriptionUnauthorized,
  READ_AT_MOST_BYTES,
  SourceFetch,
  type SourceWearing,
} from '@integrations/infrastructure/sources/source-fetch';
import { credentialsFor } from '@integrations/integrations.secrets.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const DESCRIPTION = 'https://specs.example/linear.json';

const GET = {
  url: DESCRIPTION,
  method: 'GET' as const,
  accept: 'application/json',
};

const wearing = (over: Partial<SourceWearing> = {}): SourceWearing => ({
  apiHost: 'api.linear.app',
  secrets: ['LINEAR_API_KEY'],
  connection: 'oauth-token',
  credentials: credentialsFor({
    LINEAR_API_KEY: { host: 'api.linear.app', value: 'lin_api_1' },
  }),
  ...over,
});

const answering = (...replies: Response[]) => {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => {
    const reply = replies.shift();

    if (!reply) {
      throw new Error('asked once too often');
    }

    return reply;
  });

  return {
    fetch,
    fetching: new SourceFetch(
      new OutboundPolicy(['specs.example', 'api.linear.app']),
      fetch as unknown as typeof globalThis.fetch,
    ),
    headersAt: (call: number) =>
      (fetch.mock.calls[call]?.[1]?.headers ?? {}) as Record<string, string>,
  };
};

describe('SourceFetch', () => {
  it('reads a description, wearing nothing toward a host that is not the API’s', async () => {
    const { fetching, headersAt } = answering(
      new Response('{"openapi":"3.1.0"}'),
    );

    expect(await fetching.text(GET, wearing())).toBe('{"openapi":"3.1.0"}');
    expect(headersAt(0)).toEqual({ accept: 'application/json' });
  });

  it('wears the connection and the secrets toward the API’s own host', async () => {
    const { fetching, headersAt } = answering(new Response('{}'));

    await fetching.text(
      {
        ...GET,
        url: 'https://api.linear.app/graphql',
        method: 'POST',
        body: '{}',
      },
      wearing(),
    );

    expect(headersAt(0)).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: 'lin_api_1',
    });
  });

  it('follows a redirect only to a host the deployment allows, and wears nothing past the API’s host', async () => {
    const moved = answering(
      new Response(null, {
        status: 302,
        headers: { location: 'https://specs.example/v2.json' },
      }),
      new Response('{}'),
    );

    await moved.fetching.text(
      { ...GET, url: 'https://api.linear.app/spec.json' },
      wearing({ secrets: [] }),
    );

    expect(moved.headersAt(0).authorization).toBe('Bearer oauth-token');
    expect(moved.headersAt(1).authorization).toBeUndefined();
    expect(moved.fetch.mock.calls[1]?.[0]).toBe(
      'https://specs.example/v2.json',
    );

    const astray = answering(
      new Response(null, {
        status: 301,
        headers: { location: 'https://169.254.169.254/latest' },
      }),
    );

    await expect(astray.fetching.text(GET, wearing())).rejects.toThrow(
      /not on the allowed list/,
    );
  });

  it('reads a description keyed in its query, never taking the key past the API’s host', async () => {
    const keyed = wearing({
      connection: null,
      credentials: credentialsFor({
        LINEAR_API_KEY: {
          host: 'api.linear.app',
          carrier: 'query',
          name: 'key',
          value: 'lin_api_1',
        },
      }),
    });
    const moved = answering(
      new Response(null, {
        status: 302,
        headers: { location: 'https://specs.example/v2.json?key=lin_api_1' },
      }),
      new Response('{}'),
    );

    await moved.fetching.text(
      { ...GET, url: 'https://api.linear.app/spec.json?v=2' },
      keyed,
    );

    expect(moved.fetch.mock.calls[0]?.[0]).toBe(
      'https://api.linear.app/spec.json?v=2&key=lin_api_1',
    );
    expect(moved.headersAt(0).authorization).toBeUndefined();
    expect(moved.fetch.mock.calls[1]?.[0]).toBe(
      'https://specs.example/v2.json?key=[secret]',
    );
  });

  it('will not follow an https redirect to plain http', async () => {
    const { fetching } = answering(
      new Response(null, {
        status: 302,
        headers: { location: 'http://specs.example/v2.json' },
      }),
    );

    await expect(fetching.text(GET, wearing())).rejects.toThrow(/plain http/);
  });

  it('asks again without the body after a 303', async () => {
    const { fetching, fetch } = answering(
      new Response(null, {
        status: 303,
        headers: { location: 'https://specs.example/answer.json' },
      }),
      new Response('{}'),
    );

    await fetching.text(
      { ...GET, method: 'POST', body: '{"query":"{}"}' },
      wearing(),
    );

    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'GET' });
    expect(fetch.mock.calls[1]?.[1]?.body).toBeUndefined();
  });

  it('says it could not reach a host that refused the connection', async () => {
    const fetching = new SourceFetch(
      new OutboundPolicy(['specs.example']),
      (async () => {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: Object.assign(new Error('connect ECONNREFUSED'), {
            code: 'ECONNREFUSED',
          }),
        });
      }) as unknown as typeof globalThis.fetch,
    );

    await expect(fetching.text(GET, wearing())).rejects.toThrow(
      'could not be read: specs.example: ECONNREFUSED',
    );
  });

  it('refuses a host the deployment does not allow before asking it anything', async () => {
    const { fetching, fetch } = answering();

    await expect(
      fetching.text({ ...GET, url: 'https://elsewhere.example/x' }, wearing()),
    ).rejects.toThrow(/not on the allowed list/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says what the host answered when it would not hand the description over', async () => {
    const { fetching } = answering(new Response('nope', { status: 404 }));

    await expect(fetching.text(GET, wearing())).rejects.toThrow(
      'could not be read: specs.example answered 404',
    );
  });

  it('says a host refused the credentials apart from any other refusal', async () => {
    const { fetching } = answering(new Response('nope', { status: 401 }));

    await expect(fetching.text(GET, wearing())).rejects.toBeInstanceOf(
      DescriptionUnauthorized,
    );
  });

  it('will not read a description larger than it reads', async () => {
    const { fetching } = answering(
      new Response('{}', {
        headers: { 'content-length': String(READ_AT_MOST_BYTES + 1) },
      }),
    );

    await expect(fetching.text(GET, wearing())).rejects.toThrow(
      'is larger than the 64 MB Spotlight reads',
    );
  });
});
