import { generateKeyPairSync } from 'node:crypto';
import type { Env } from '@infrastructure/config/env.schema';
import { GitHubAppIdentity } from '@infrastructure/github/github-app.identity';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const env = {
  GITHUB_APP_ID: '1',
  GITHUB_APP_PRIVATE_KEY: privateKey.export({
    type: 'pkcs1',
    format: 'pem',
  }) as string,
} as Env;

const answering = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitHubAppIdentity', () => {
  it('builds the install URL from what GitHub calls the App', async () => {
    vi.stubGlobal('fetch', answering({ slug: 'spotlight-dev' }));

    await expect(new GitHubAppIdentity(env).installUrl()).resolves.toBe(
      'https://github.com/apps/spotlight-dev/installations/new',
    );
  });

  it('speaks as the App itself', async () => {
    const fetching = answering({ slug: 'spotlight-dev' });
    vi.stubGlobal('fetch', fetching);

    await new GitHubAppIdentity(env).installUrl();

    const [url, init] = fetching.mock.calls[0];
    expect(url).toBe('https://api.github.com/app');
    expect(init.headers.authorization).toMatch(/^Bearer ey/);
  });

  // A slug is settled when the App is created and does not change.
  it('asks once and remembers', async () => {
    const fetching = answering({ slug: 'spotlight-dev' });
    vi.stubGlobal('fetch', fetching);

    const identity = new GitHubAppIdentity(env);
    await identity.installUrl();
    await identity.installUrl();

    expect(fetching).toHaveBeenCalledTimes(1);
  });

  // Onboarding is read on every visit, and a link is not worth failing over.
  it('answers null where GitHub refuses', async () => {
    vi.stubGlobal('fetch', answering({}, false));

    await expect(new GitHubAppIdentity(env).installUrl()).resolves.toBeNull();
  });

  it('answers null where GitHub cannot be reached at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(new GitHubAppIdentity(env).installUrl()).resolves.toBeNull();
  });
});
