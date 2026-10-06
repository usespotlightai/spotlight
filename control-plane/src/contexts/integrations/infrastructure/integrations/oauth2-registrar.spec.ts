import { OutboundRefusedError } from '@integrations/domain/exceptions/outbound-refused.error';
import { OAuth2Registrar } from '@integrations/infrastructure/integrations/oauth2-registrar';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { describe, expect, it, vi } from 'vitest';

const ENDPOINT = 'https://mcp.example/register';
const CALLBACK = 'https://app.example/api/integrations/oauth/callback';

const registering = (reply: Response) => {
  const fetch = vi.fn(async () => reply);

  return {
    fetch,
    registrar: new OAuth2Registrar(new OutboundPolicy(['mcp.example']), fetch),
  };
};

describe('OAuth2Registrar', () => {
  it('registers Spotlight’s callback and keeps the client it is given', async () => {
    const { fetch, registrar } = registering(
      Response.json({
        client_id: 'c-1',
        client_secret: 's-1',
        client_secret_expires_at: 1_800_000_000,
      }),
    );

    expect(await registrar.register(ENDPOINT, CALLBACK)).toEqual({
      clientId: 'c-1',
      clientSecret: 's-1',
      secretExpiresAt: new Date(1_800_000_000_000),
    });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).redirect_uris).toEqual([CALLBACK]);
    expect(init.redirect).toBe('manual');
  });

  it('never follows a redirect, and registers nothing from one', async () => {
    const { fetch, registrar } = registering(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest' },
      }),
    );

    expect(await registrar.register(ENDPOINT, CALLBACK)).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('refuses an endpoint the deployment did not allow', async () => {
    const { fetch, registrar } = registering(Response.json({}));

    await expect(
      registrar.register('https://elsewhere.example/register', CALLBACK),
    ).rejects.toBeInstanceOf(OutboundRefusedError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
