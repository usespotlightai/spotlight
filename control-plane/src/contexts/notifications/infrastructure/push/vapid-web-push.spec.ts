import { VapidWebPush } from '@notifications/infrastructure/push/vapid-web-push';
import type { OutboundGuard } from '@platform/outbound/outbound-guard';
import { describe, expect, it, vi } from 'vitest';
import { generateVAPIDKeys } from 'web-push';

const TARGET = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  p256dh:
    'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
};

const pushWith = (status: number) => {
  const keys = generateVAPIDKeys();
  const fetch = vi.fn(async () => new Response(null, { status }));
  const push = new VapidWebPush(
    {
      subject: 'mailto:ops@example.com',
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    },
    { fetch } as unknown as OutboundGuard,
  );

  return { push, fetch };
};

describe('VapidWebPush', () => {
  it('sends the payload encrypted with aes128gcm and refuses redirects', async () => {
    const { push, fetch } = pushWith(201);

    expect(await push.send(TARGET, '{"title":"Hi"}')).toBe('delivered');

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TARGET.endpoint);
    expect(init.redirect).toBe('error');
    expect((init.headers as Record<string, string>)['Content-Encoding']).toBe(
      'aes128gcm',
    );
    expect(new TextDecoder().decode(init.body as Uint8Array)).not.toContain(
      'Hi',
    );
  });

  it.each([404, 410])('says the subscription is gone on %i', async (status) => {
    expect(await pushWith(status).push.send(TARGET, '{}')).toBe('gone');
  });

  it.each([400, 403, 413])(
    'says the push service refused on %i, without forgetting the browser or trying again',
    async (status) => {
      expect(await pushWith(status).push.send(TARGET, '{}')).toBe('refused');
    },
  );

  it.each([429, 503])(
    'fails on %i, so that the delivery is tried again',
    async (status) => {
      await expect(pushWith(status).push.send(TARGET, '{}')).rejects.toThrow(
        `The push service answered ${status}`,
      );
    },
  );

  it('has no key and sends nothing without VAPID details', async () => {
    const fetch = vi.fn();
    const push = new VapidWebPush(null, { fetch } as unknown as OutboundGuard);

    expect(push.publicKey).toBeNull();
    expect(await push.send(TARGET, '{}')).toBe('delivered');
    expect(fetch).not.toHaveBeenCalled();
  });
});
