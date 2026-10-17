import type { OAuth2IR } from '@integrations/infrastructure/integrations/integration.compile';
import { OAuth2Discovery } from '@integrations/infrastructure/integrations/oauth2-discovery';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { describe, expect, it, vi } from 'vitest';

const SERVER = 'https://mcp.tracker.example/mcp';
const METADATA =
  'https://mcp.tracker.example/.well-known/oauth-protected-resource/mcp';
const ISSUER = 'https://auth.tracker.example';

const DISCOVERED: OAuth2IR = {
  discoverAt: SERVER,
  scopes: [],
  identity: null,
  resource: null,
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const answering = (
  over: {
    resource?: string;
    methods?: readonly string[];
    issuer?: string;
  } = {},
) =>
  vi.fn(async (url: string | URL | Request) => {
    const requested = url.toString();

    if (requested === SERVER) {
      return new Response(null, {
        status: 401,
        headers: {
          'www-authenticate': `Bearer resource_metadata="${METADATA}"`,
        },
      });
    }

    if (requested === METADATA) {
      return json({
        resource: over.resource ?? SERVER,
        authorization_servers: [ISSUER],
        scopes_supported: ['read', 'write'],
      });
    }

    if (requested === `${ISSUER}/.well-known/oauth-authorization-server`) {
      return json({
        issuer: over.issuer ?? ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        registration_endpoint: `${ISSUER}/register`,
        response_types_supported: ['code'],
        code_challenge_methods_supported: over.methods ?? ['S256'],
      });
    }

    return new Response(null, { status: 404 });
  });

const clock = { now: () => new Date('2026-10-05T10:00:00.000Z') } as ClockPort;

const discovery = (
  fetch: ReturnType<typeof answering>,
  allowed = ['mcp.tracker.example', 'auth.tracker.example'],
) => new OAuth2Discovery(new OutboundPolicy(allowed), clock, fetch);

describe('OAuth2Discovery', () => {
  it('finds where to authorize, exchange and register from the server’s protected resource metadata', async () => {
    const fetch = answering();

    await expect(discovery(fetch).endpoints(DISCOVERED)).resolves.toEqual({
      issuer: ISSUER,
      authorize: `${ISSUER}/authorize`,
      token: `${ISSUER}/token`,
      registration: `${ISSUER}/register`,
      resource: SERVER,
      scopes: ['read', 'write'],
      identity: null,
    });
    expect(fetch.mock.calls.map(([url]) => url.toString())).toContain(METADATA);
  });

  it('caches what it found for a while, and requests nothing again', async () => {
    const fetch = answering();
    const found = discovery(fetch);

    await found.endpoints(DISCOVERED);
    const requested = fetch.mock.calls.length;
    await found.endpoints({ ...DISCOVERED, scopes: ['read'] });

    expect(fetch.mock.calls.length).toBe(requested);
    await expect(
      found.endpoints({ ...DISCOVERED, scopes: ['read'] }),
    ).resolves.toMatchObject({ scopes: ['read'] });
  });

  it('hands back endpoints the definition names, without any request', async () => {
    const fetch = answering();
    const named: OAuth2IR = {
      discoverAt: null,
      authorize: 'https://slack.com/oauth/authorize',
      token: 'https://slack.com/api/oauth.v2.access',
      scopes: ['chat:write'],
      identity: null,
      registration: null,
      resource: null,
    };

    const { discoverAt: _, ...endpoints } = named;

    await expect(discovery(fetch).endpoints(named)).resolves.toEqual({
      ...endpoints,
      issuer: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an authorization server that does not take S256 PKCE', async () => {
    await expect(
      discovery(answering({ methods: ['plain'] })).endpoints(DISCOVERED),
    ).resolves.toBeNull();
  });

  it('rejects authorization server metadata that names another issuer than the server it was read from', async () => {
    await expect(
      discovery(answering({ issuer: 'https://evil.example' })).endpoints(
        DISCOVERED,
      ),
    ).resolves.toBeNull();
  });

  it('rejects metadata naming a resource other than the server', async () => {
    await expect(
      discovery(answering({ resource: 'https://evil.example/mcp' })).endpoints(
        DISCOVERED,
      ),
    ).resolves.toBeNull();
  });

  it('requests nothing from an authorization server on a host the deployment does not allow', async () => {
    const fetch = answering();

    await expect(
      discovery(fetch, ['mcp.tracker.example']).endpoints(DISCOVERED),
    ).resolves.toBeNull();
    expect(
      fetch.mock.calls.some(([url]) => url.toString().startsWith(ISSUER)),
    ).toBe(false);
  });
});
