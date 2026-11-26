import { generateKeyPairSync } from 'node:crypto';

import { GitHubAppHookDeliveries } from '@github/infrastructure/github/github-app-hook-deliveries';
import type { Env } from '@platform/config/env.schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const env = {
  GITHUB_APP_ID: '1',
  GITHUB_APP_PRIVATE_KEY: privateKey.export({
    type: 'pkcs1',
    format: 'pem',
  }),
} as Env;

const ID = '3856285345890959360';

const answering = (status: number, body: unknown, link: string | null = null) =>
  vi
    .fn<
      (
        url: string,
        init: RequestInit & { headers: Record<string, string> },
      ) => unknown
    >()
    .mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers(link ? { link } : {}),
      text: async () =>
        typeof body === 'string' ? body : JSON.stringify(body),
      json: async (): Promise<unknown> =>
        typeof body === 'string' ? (JSON.parse(body) as unknown) : body,
    });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitHubAppHookDeliveries', () => {
  it('lists the deliveries of the App, acting as the App itself', async () => {
    const fetching = answering(200, [
      {
        id: 7,
        guid: 'g-1',
        delivered_at: '2026-11-26T12:31:00Z',
        status_code: 500,
        redelivery: false,
      },
    ]);
    vi.stubGlobal('fetch', fetching);

    const page = await new GitHubAppHookDeliveries(env).page(null);

    const [url, init] = fetching.mock.calls[0];
    expect(url).toBe('https://api.github.com/app/hook/deliveries?per_page=100');
    expect(init.headers.authorization).toMatch(/^Bearer ey/);
    expect(page).toEqual({
      attempts: [
        {
          id: '7',
          guid: 'g-1',
          deliveredAt: new Date('2026-11-26T12:31:00Z'),
          statusCode: 500,
        },
      ],
      next: null,
    });
  });

  it('asks for a new attempt of a listed delivery by its exact 64-bit id', async () => {
    vi.stubGlobal(
      'fetch',
      answering(
        200,
        `[{"id":${ID},"guid":"g-1","delivered_at":"2026-11-26T12:31:00Z","status_code":500,"installation_id":${ID}}]`,
      ),
    );
    const deliveries = new GitHubAppHookDeliveries(env);
    const [listed] = (await deliveries.page(null)).attempts;
    const fetching = answering(202, {});
    vi.stubGlobal('fetch', fetching);

    await deliveries.redeliver(listed?.id ?? '');

    expect(listed?.id).toBe(ID);
    expect(fetching.mock.calls[0]?.[0]).toBe(
      'https://api.github.com/app/hook/deliveries/3856285345890959360/attempts',
    );
  });

  it('fails where GitHub does not list the deliveries', async () => {
    vi.stubGlobal('fetch', answering(401, { message: 'Bad credentials' }));

    await expect(new GitHubAppHookDeliveries(env).page(null)).rejects.toThrow(
      'Bad credentials',
    );
  });

  it('follows the cursor of the next page', async () => {
    const fetching = answering(
      200,
      [],
      '<https://api.github.com/app/hook/deliveries?per_page=100&cursor=v1_6>; rel="next"',
    );
    vi.stubGlobal('fetch', fetching);
    const deliveries = new GitHubAppHookDeliveries(env);

    const first = await deliveries.page(null);
    await deliveries.page(first.next);

    expect(first.next).toBe('v1_6');
    expect(fetching.mock.calls[1]?.[0]).toBe(
      'https://api.github.com/app/hook/deliveries?per_page=100&cursor=v1_6',
    );
  });

  it('asks for a new attempt of a delivery', async () => {
    const fetching = answering(202, {});
    vi.stubGlobal('fetch', fetching);

    await new GitHubAppHookDeliveries(env).redeliver(ID);

    const [url, init] = fetching.mock.calls[0];
    expect(url).toBe(
      `https://api.github.com/app/hook/deliveries/${ID}/attempts`,
    );
    expect(init.method).toBe('POST');
  });

  it('fails where GitHub refuses', async () => {
    vi.stubGlobal('fetch', answering(422, { message: 'Too old' }));

    await expect(
      new GitHubAppHookDeliveries(env).redeliver(ID),
    ).rejects.toThrow('Too old');
  });
});
