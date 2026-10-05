import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import { OutboundRefusedError } from '@integrations/domain/exceptions/outbound-refused.error';
import {
  compileIntegration,
  type RequestIR,
} from '@integrations/infrastructure/integrations/integration.compile';
import {
  ANSWER_AT_MOST_BYTES,
  HttpOutbound,
} from '@integrations/infrastructure/outbound/http-outbound';
import {
  credentialsFor,
  injecting,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { ExpressionFailedError } from '@platform/expressions/expression.errors';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

const FIXTURE = `
integration: demo
actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      auth:
        secrets: [secret.TOKEN]
      body: '\${{ {"channel": target.channel, "text": ask.body} }}'
      expect:
        success: '\${{ response.ok }}'
      capture:
        thread: '\${{ response.ts }}'
`;

const action = (): RequestIR => {
  const read = compileIntegration(parseYaml(FIXTURE), expressions);

  if (!read.ok) {
    throw new Error(read.problems.map((each) => each.reason).join(', '));
  }

  return read.readable.actions.get('post-message') as RequestIR;
};

const replying = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

const against = {
  ask: { body: 'The queue is stuck.' },
  target: { channel: 'C0DELIVERY' },
};

const SLACK = credentialsFor({
  TOKEN: { host: 'slack.com', prefix: 'Bearer ', value: 'xoxb-1' },
});

describe('HttpOutbound', () => {
  it('makes the call the file describes, with the templated body and headers', async () => {
    const fetch = replying({ ok: true, ts: '170.5' });
    const out = new HttpOutbound(['slack.com'], fetch);

    await out.run(action(), against, SLACK);

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer xoxb-1',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      channel: 'C0DELIVERY',
      text: 'The queue is stuck.',
    });
  });

  it('says the body is JSON so a host parses it rather than reading form data', async () => {
    const fetch = replying({ ok: true, ts: '1' });
    const out = new HttpOutbound(['slack.com'], fetch);

    await out.run(action(), against, SLACK);

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    );
  });

  it('leaves a content-type the file set alone', async () => {
    const FORM = `
integration: demo
actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      headers:
        content-type: application/x-www-form-urlencoded
      body: '\${{ {"channel": target.channel} }}'
`;
    const read = compileIntegration(parseYaml(FORM), expressions);
    const request = read.ok
      ? (read.readable.actions.get('post-message') as RequestIR)
      : (() => {
          throw new Error('did not compile');
        })();

    const fetch = replying({ ok: true });
    const out = new HttpOutbound(['slack.com'], fetch);

    await out.run(request, against, SLACK);

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
  });

  it('reads success and captures from the reply', async () => {
    const out = new HttpOutbound(
      ['slack.com'],
      replying({ ok: true, ts: '170.5' }),
    );

    const result = await out.run(action(), against, SLACK);

    expect(result.ok).toBe(true);
    expect(result.capture.thread).toBe('170.5');
  });

  it('reports not-ok when the host says so, even on a 200', async () => {
    const out = new HttpOutbound(
      ['slack.com'],
      replying({ ok: false, error: 'channel_not_found' }),
    );

    expect((await out.run(action(), against, SLACK)).ok).toBe(false);
  });

  it('sends nothing where the body cannot be read, and says where', async () => {
    const fetch = replying({ ok: true });
    const out = new HttpOutbound(['slack.com'], fetch);

    await expect(
      out.run(action(), { ...against, ask: {} }, SLACK),
    ).rejects.toThrow(
      new ExpressionFailedError(
        'actions.post-message.request.body',
        '',
        'No such key: body',
      ).message,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends nothing where the secret it wears is not bound to the host', async () => {
    const fetch = replying({ ok: true });
    const out = new HttpOutbound(['slack.com'], fetch);

    await expect(
      out.run(
        action(),
        against,
        credentialsFor({ TOKEN: { host: 'api.linear.app', value: 'lin-1' } }),
      ),
    ).rejects.toThrow('The TOKEN secret is not bound to slack.com');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks for the secret only once the deployment allows the host', async () => {
    const fetch = replying({ ok: true });
    const { injection, forSpotlight } = injecting({
      TOKEN: { host: 'slack.com', value: 'xoxb-1' },
    });
    const out = new HttpOutbound(['example.com'], fetch);

    await expect(
      out.run(
        action(),
        against,
        new SpotlightCredentials(injection, async () => 'ws_1'),
      ),
    ).rejects.toBeInstanceOf(OutboundRefusedError);
    expect(forSpotlight).not.toHaveBeenCalled();
  });

  it('asks for the secrets the action names, toward the address it calls', async () => {
    const { injection, forSpotlight } = injecting({
      TOKEN: { host: 'slack.com', value: 'xoxb-1' },
    });

    await new HttpOutbound(['slack.com'], replying({ ok: true })).run(
      action(),
      against,
      new SpotlightCredentials(injection, async () => 'ws_1'),
    );

    expect(forSpotlight).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      secrets: ['TOKEN'],
      url: 'https://slack.com/api/chat.postMessage',
    });
  });

  it('follows a redirect itself, wearing nothing toward another host', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.startsWith('https://slack.com')
        ? new Response(null, {
            status: 307,
            headers: { location: 'https://files.slack-edge.com/post' },
          })
        : new Response(JSON.stringify({ ok: true, ts: '1' })),
    );

    await new HttpOutbound(
      ['slack.com', 'slack-edge.com'],
      fetch as unknown as typeof globalThis.fetch,
    ).run(action(), against, SLACK);

    const [first, second] = fetch.mock.calls as unknown as [
      [string, RequestInit],
      [string, RequestInit],
    ];
    expect(first[1].redirect).toBe('manual');
    expect((first[1].headers as Record<string, string>).authorization).toBe(
      'Bearer xoxb-1',
    );
    expect(second[0]).toBe('https://files.slack-edge.com/post');
    expect(second[1].method).toBe('POST');
    expect(
      (second[1].headers as Record<string, string>).authorization,
    ).toBeUndefined();
  });

  it('checks every host a redirect sends it to', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://169.254.169.254/latest' },
        }),
    );

    await expect(
      new HttpOutbound(['slack.com'], fetch).run(action(), against, SLACK),
    ).rejects.toBeInstanceOf(OutboundRefusedError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses an answer larger than it reads from a tool', async () => {
    const fetch = vi.fn(
      async () =>
        new Response('{}', {
          headers: { 'content-length': String(ANSWER_AT_MOST_BYTES + 1) },
        }),
    );

    await expect(
      new HttpOutbound(['slack.com'], fetch).answer(
        { method: 'GET', url: 'https://slack.com/api/x', headers: {} },
        null,
        null,
        SLACK,
      ),
    ).rejects.toThrow(/larger than the 4 MB/);
  });

  it('refuses a host the deployment did not allow', async () => {
    const fetch = replying({ ok: true });
    const out = new HttpOutbound(['example.com'], fetch);

    await expect(out.run(action(), against, SLACK)).rejects.toBeInstanceOf(
      OutboundRefusedError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows a subdomain of an allowed host', async () => {
    const fetch = replying({ ok: true, ts: '1' });
    const out = new HttpOutbound(['slack.com'], fetch);

    await out.run(action(), against, SLACK);
    expect(fetch).toHaveBeenCalled();
  });

  it('wears the connection token where the action authenticates by oauth2', async () => {
    const OAUTH = `
integration: demo
connection:
  oauth2:
    authorize: https://slack.com/oauth/authorize
    token: https://slack.com/api/oauth.v2.access
actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      auth:
        oauth2:
          connection: true
`;
    const read = compileIntegration(parseYaml(OAUTH), expressions);
    const request = read.ok
      ? (read.readable.actions.get('post-message') as RequestIR)
      : (() => {
          throw new Error('did not compile');
        })();

    const fetch = replying({ ok: true });
    const out = new HttpOutbound(['slack.com'], fetch);

    await out.run(request, { ...against, connection: 'xoxb-live' }, SLACK);

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer xoxb-live',
    );
  });

  describe('fetching a file', () => {
    const FILE = `
integration: demo
actions:
  fetch:
    request:
      method: GET
      url: '\${{ file.url }}'
      auth:
        secrets: [secret.TOKEN]
      expect:
        success: '\${{ status == 200 && !headers["content-type"].startsWith("text/html") }}'
`;

    const fetching = (): RequestIR => {
      const read = compileIntegration(parseYaml(FILE), expressions);

      if (!read.ok) {
        throw new Error(read.problems.map((each) => each.reason).join(', '));
      }

      return read.readable.actions.get('fetch') as RequestIR;
    };

    const named = {
      file: { url: 'https://files.slack.com/files-pri/T1-F1/queue.png' },
    };

    const FILES = credentialsFor({
      TOKEN: { host: 'files.slack.com', prefix: 'Bearer ', value: 'xoxb-1' },
    });

    const answering = (body: BodyInit, type: string) =>
      vi.fn(
        async () =>
          new Response(body, {
            status: 200,
            headers: { 'content-type': type },
          }),
      );

    it('hands the bytes back whole, wearing the token', async () => {
      const fetch = answering(new Uint8Array([1, 2, 3]), 'image/png');

      await expect(
        new HttpOutbound(['slack.com'], fetch).bytes(fetching(), named, FILES),
      ).resolves.toEqual(new Uint8Array([1, 2, 3]));

      const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
      expect((init.headers as Record<string, string>).authorization).toBe(
        'Bearer xoxb-1',
      );
    });

    it('refuses a page standing in for the file', async () => {
      const fetch = answering(
        '<html>Sign in</html>',
        'text/html; charset=utf-8',
      );

      await expect(
        new HttpOutbound(['slack.com'], fetch).bytes(fetching(), named, FILES),
      ).rejects.toThrow(UpstreamRefusedError);
    });

    it('refuses a host the deployment does not allow', async () => {
      await expect(
        new HttpOutbound(['github.com'], vi.fn()).bytes(
          fetching(),
          named,
          FILES,
        ),
      ).rejects.toThrow(OutboundRefusedError);
    });
  });
});

describe('HttpOutbound, a request written out', () => {
  const WRITTEN = `
integration: demo
actions:
  post:
    request:
      method: POST
      url: https://slack.com/api/\${{ target.method }}
      auth:
        secrets: [secret.TOKEN]
      body:
        channel: '\${{ target.channel }}'
        text: 'Asked at \${{ ask.station }}: \${{ ask.body }}'
        attempt: '\${{ 1 + 1 }}'
        unfurl: false
`;

  const written = (text = WRITTEN, name = 'post') => {
    const read = compileIntegration(parseYaml(text), expressions);

    if (!read.ok) {
      throw new Error(read.problems.map((each) => each.reason).join(', '));
    }

    return read.readable.actions.get(name) as RequestIR;
  };

  const asked = {
    ask: { body: 'The queue is stuck.', station: 'Triage' },
    target: {
      channel: 'C0DELIVERY',
      thread: '170.5',
      method: 'chat.postMessage',
    },
    task: {
      marks: { 'git.pull-request': 'https://github.com/acme/api/pull/9' },
    },
  };

  it('sends the structure the file wrote, each piece read in', async () => {
    const fetch = replying({ ok: true });

    await new HttpOutbound(['slack.com'], fetch).run(written(), asked, SLACK);

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer xoxb-1',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      channel: 'C0DELIVERY',
      text: 'Asked at Triage: The queue is stuck.',
      attempt: 2,
      unfurl: false,
    });
  });

  it('sends nothing where a piece of the body cannot be read, and says where', async () => {
    const fetch = replying({ ok: true });

    await expect(
      new HttpOutbound(['slack.com'], fetch).run(
        written(),
        { ...asked, ask: { station: 'Triage' } },
        SLACK,
      ),
    ).rejects.toThrow(/actions\.post\.request\.body\.text/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
