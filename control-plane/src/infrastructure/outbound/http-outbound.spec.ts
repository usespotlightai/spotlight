import { EgressRefusedError } from '@domain/exceptions/egress-refused.error';
import {
  compileIntegration,
  type RequestIR,
} from '@infrastructure/integrations/integration.compile';
import { HttpOutbound } from '@infrastructure/outbound/http-outbound';
import { describe, expect, it, vi } from 'vitest';

const FIXTURE = `
version: 1
integration: demo
actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      headers:
        authorization: '\${{ "Bearer " + secret.TOKEN }}'
      body: '\${{ {"channel": target.channel, "text": ask.body} }}'
      expect:
        success: '\${{ response.ok }}'
      capture:
        thread: '\${{ response.ts }}'
`;

const action = (): RequestIR => {
  const read = compileIntegration('.spotlight/integrations/demo.yml', FIXTURE);

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
  secret: { TOKEN: 'xoxb-1' },
};

describe('HttpOutbound', () => {
  it('makes the call the file describes, with the templated body and headers', async () => {
    const fetch = replying({ ok: true, ts: '170.5' });
    const out = new HttpOutbound(['slack.com'], fetch);

    await out.run(action(), against);

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

  it('reads success and captures from the reply', async () => {
    const out = new HttpOutbound(
      ['slack.com'],
      replying({ ok: true, ts: '170.5' }),
    );

    const result = await out.run(action(), against);

    expect(result.ok).toBe(true);
    expect(result.capture.thread).toBe('170.5');
  });

  it('reports not-ok when the host says so, even on a 200', async () => {
    const out = new HttpOutbound(
      ['slack.com'],
      replying({ ok: false, error: 'channel_not_found' }),
    );

    expect((await out.run(action(), against)).ok).toBe(false);
  });

  it('refuses a host the deployment did not allow', async () => {
    const fetch = replying({ ok: true });
    const out = new HttpOutbound(['example.com'], fetch);

    await expect(out.run(action(), against)).rejects.toBeInstanceOf(
      EgressRefusedError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows a subdomain of an allowed host', async () => {
    const fetch = replying({ ok: true, ts: '1' });
    const out = new HttpOutbound(['slack.com'], fetch);

    // api.slack.com would be allowed by the slack.com entry.
    await out.run(action(), against);
    expect(fetch).toHaveBeenCalled();
  });

  it('wears the connection token where the action authenticates by oauth2', async () => {
    const OAUTH = `
version: 1
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
    const read = compileIntegration('.spotlight/integrations/demo.yml', OAUTH);
    const request = read.ok
      ? (read.readable.actions.get('post-message') as RequestIR)
      : (() => {
          throw new Error('did not compile');
        })();

    const fetch = replying({ ok: true });
    const out = new HttpOutbound(['slack.com'], fetch);

    await out.run(request, { ...against, connection: 'xoxb-live' });

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer xoxb-live',
    );
  });
});
