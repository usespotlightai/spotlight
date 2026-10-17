import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import {
  compileIntegration,
  type OAuth2Endpoints,
} from '@integrations/infrastructure/integrations/integration.compile';
import { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

const NOW = new Date('2026-09-07T10:00:00.000Z');
const CLIENT = { id: 'c-1', secret: 's-1' };

const FIXTURE = `
integration: slack
connection:
  oauth2:
    authorize: https://slack.com/oauth/authorize
    token: https://slack.com/api/oauth.v2.access
    scopes:
      - chat:write
    identity: '\${{ response.team.name }}'
webhook:
  verify:
    token:
      secret: secret.SLACK_SIGNING_SECRET
  events:
    - when: '\${{ true }}'
      raise:
        happening: slack.app_mention
        marks:
          - kind: slack.thread
            value: '\${{ body.event.ts }}'
`;

const oauth2 = (): OAuth2Endpoints => {
  const read = compileIntegration(parseYaml(FIXTURE), expressions);
  const written = read.ok ? read.readable.connection?.oauth2 : null;

  if (!written || written.discoverAt !== null) {
    throw new Error('fixture did not compile with oauth2 endpoints');
  }

  return { ...written, issuer: null };
};

const replying = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

const clock = { now: () => NOW } as ClockPort;

describe('OAuth2Exchange', () => {
  it('turns a code into tokens, an expiry, scopes and an identity', async () => {
    const fetch = replying({
      access_token: 'xoxb-1',
      refresh_token: 'xoxe-1',
      expires_in: 3600,
      scope: 'chat:write channels:read',
      team: { name: 'Acme' },
    });
    const exchange = new OAuth2Exchange(
      new OutboundPolicy(['slack.com']),
      clock,
      fetch,
    );

    const linked = await exchange.exchange(
      oauth2(),
      CLIENT,
      'the-code',
      'https://app.example/callback',
      'the-verifier',
    );

    expect(linked?.accessToken.value).toBe('xoxb-1');
    expect(linked?.refreshToken?.value).toBe('xoxe-1');
    expect(linked?.expiresAt).toEqual(new Date('2026-09-07T11:00:00.000Z'));
    expect(linked?.scopes).toEqual(['chat:write', 'channels:read']);
    expect(linked?.handle).toBe('Acme');
  });

  it('sends the code and the client credentials to the token endpoint', async () => {
    const fetch = replying({ access_token: 'xoxb-1' });
    const exchange = new OAuth2Exchange(
      new OutboundPolicy(['slack.com']),
      clock,
      fetch,
    );

    await exchange.exchange(
      oauth2(),
      CLIENT,
      'the-code',
      'https://app.example/callback',
      'the-verifier',
    );

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://slack.com/api/oauth.v2.access');
    const form = new URLSearchParams(init.body as string);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('the-code');
    expect(form.get('redirect_uri')).toBe('https://app.example/callback');
    expect(form.get('client_id')).toBe('c-1');
    expect(form.get('client_secret')).toBe('s-1');
    expect(form.get('code_verifier')).toBe('the-verifier');
    expect(form.get('resource')).toBeNull();
  });

  it('sends only the client id for a client registered without a secret', async () => {
    const fetch = replying({ access_token: 'xoxb-1' });
    const exchange = new OAuth2Exchange(
      new OutboundPolicy(['slack.com']),
      clock,
      fetch,
    );

    await exchange.refresh(oauth2(), { id: 'public-1', secret: null }, 'r-1');

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const form = new URLSearchParams(init.body as string);
    expect(form.get('client_id')).toBe('public-1');
    expect(form.has('client_secret')).toBe(false);
  });

  it('names the resource it wants a token for, where the file names one', async () => {
    const fetch = replying({ access_token: 'xoxb-1' });
    const exchange = new OAuth2Exchange(
      new OutboundPolicy(['slack.com']),
      clock,
      fetch,
    );

    await exchange.refresh(
      { ...oauth2(), resource: 'https://mcp.slack.com/' },
      CLIENT,
      'r-1',
    );

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URLSearchParams(init.body as string).get('resource')).toBe(
      'https://mcp.slack.com/',
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('falls back to the file’s scopes where the host names none', async () => {
    const fetch = replying({ access_token: 'xoxb-1' });
    const exchange = new OAuth2Exchange(
      new OutboundPolicy(['slack.com']),
      clock,
      fetch,
    );

    const linked = await exchange.exchange(
      oauth2(),
      CLIENT,
      'the-code',
      'https://app.example/callback',
      'the-verifier',
    );

    expect(linked?.scopes).toEqual(['chat:write']);
  });

  it('refreshes with the refresh token', async () => {
    const fetch = replying({ access_token: 'xoxb-2', refresh_token: 'xoxe-2' });
    const exchange = new OAuth2Exchange(
      new OutboundPolicy(['slack.com']),
      clock,
      fetch,
    );

    const linked = await exchange.refresh(oauth2(), CLIENT, 'xoxe-1');

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const form = new URLSearchParams(init.body as string);
    expect(form.get('grant_type')).toBe('refresh_token');
    expect(form.get('refresh_token')).toBe('xoxe-1');
    expect(linked?.accessToken.value).toBe('xoxb-2');
  });

  it('blocks a token endpoint the deployment did not allow', async () => {
    const fetch = replying({ access_token: 'xoxb-1' });
    const exchange = new OAuth2Exchange(
      new OutboundPolicy(['example.com']),
      clock,
      fetch,
    );

    await expect(
      exchange.exchange(
        oauth2(),
        CLIENT,
        'c',
        'https://app.example/callback',
        'v',
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stores nothing when the host answers with an error', async () => {
    const fetch = replying({ error: 'bad_code' }, 400);
    const exchange = new OAuth2Exchange(
      new OutboundPolicy(['slack.com']),
      clock,
      fetch,
    );

    expect(
      await exchange.exchange(
        oauth2(),
        CLIENT,
        'c',
        'https://app.example/cb',
        'v',
      ),
    ).toBeNull();
  });

  it('never follows a redirect from the token endpoint, and stores nothing from it', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 307,
          headers: { location: 'https://elsewhere.example/token' },
        }),
    );
    const exchange = new OAuth2Exchange(
      new OutboundPolicy(['slack.com']),
      clock,
      fetch,
    );

    expect(await exchange.refresh(oauth2(), CLIENT, 'r-1')).toBeNull();
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.redirect).toBe('manual');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
