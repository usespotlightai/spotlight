import { generateKeyPairSync } from 'node:crypto';

import type { InstallationsPort } from '@github/application/ports/installations.port';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { GitHubAppAccess } from '@github/infrastructure/github/github-app.access';
import type { Env } from '@platform/config/env.schema';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const env = partial<Env>({
  GITHUB_APP_ID: '1',
  GITHUB_APP_PRIVATE_KEY: privateKey.export({
    type: 'pkcs1',
    format: 'pem',
  }),
});

const WORKSPACE = WorkspaceId.of('123e4567-e89b-42d3-a456-426614174001');

const installed = (installation: string | null = '42') =>
  partial<InstallationsPort>({
    of: async () => GitHubInstallation.of(installation ?? '0'),
    maybe: async () =>
      installation === null ? null : GitHubInstallation.of(installation),
  });

const answer = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => body,
});

const IN_AN_HOUR = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const github = (granted: { current: Record<string, string> }) => {
  let minted = 0;
  const fetching = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      minted += 1;
      return answer({
        token: `token_${minted}`,
        expires_at: IN_AN_HOUR,
        permissions: { ...granted.current },
      });
    }
    return url.endsWith('/app/installations/42')
      ? answer({ permissions: { ...granted.current } })
      : answer({}, false);
  });
  vi.stubGlobal('fetch', fetching);
  return fetching;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('GitHubAppAccess', () => {
  it('reads what the installation may do, as the App itself', async () => {
    const fetching = github({
      current: { contents: 'write', workflows: 'write' },
    });

    await expect(
      new GitHubAppAccess(env, installed()).of(WORKSPACE),
    ).resolves.toEqual({ workflows: true, variables: false });

    const [url, init] = fetching.mock.calls[0] ?? [];
    expect(url).toBe('https://api.github.com/app/installations/42');
    expect(new Headers(init?.headers).get('authorization')).toMatch(
      /^Bearer ey/,
    );
  });

  it('answers null for a workspace without an installation, and asks GitHub nothing', async () => {
    const fetching = github({ current: {} });

    await expect(
      new GitHubAppAccess(env, installed(null)).of(WORKSPACE),
    ).resolves.toBeNull();
    expect(fetching).not.toHaveBeenCalled();
  });

  it('answers null when GitHub would not say', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => answer({}, false)),
    );

    await expect(
      new GitHubAppAccess(env, installed()).of(WORKSPACE),
    ).resolves.toBeNull();
  });

  it('answers null when GitHub cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(
      new GitHubAppAccess(env, installed()).of(WORKSPACE),
    ).resolves.toBeNull();
  });

  it('answers null when it cannot sign as the App', async () => {
    const fetching = github({ current: { workflows: 'write' } });

    await expect(
      new GitHubAppAccess(
        partial<Env>({
          GITHUB_APP_ID: '1',
          GITHUB_APP_PRIVATE_KEY: 'not-a-key',
        }),
        installed(),
      ).of(WORKSPACE),
    ).resolves.toBeNull();
    expect(fetching).not.toHaveBeenCalled();
  });

  it('reads the permissions again only after a short while', async () => {
    vi.useFakeTimers();
    const fetching = github({ current: { workflows: 'write' } });
    const access = new GitHubAppAccess(env, installed());

    await access.of(WORKSPACE);
    await access.of(WORKSPACE);
    expect(fetching).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31_000);
    await access.of(WORKSPACE);
    expect(fetching).toHaveBeenCalledTimes(2);
  });

  it('mints a new token once someone accepts new permissions, so pushes get them', async () => {
    const granted = {
      current: { contents: 'write' } as Record<string, string>,
    };
    github(granted);
    const access = new GitHubAppAccess(env, installed());

    const before = await access.credential(WORKSPACE);
    await access.of(WORKSPACE);
    await expect(access.credential(WORKSPACE)).resolves.toEqual(before);

    vi.useFakeTimers();
    vi.advanceTimersByTime(31_000);
    granted.current = { contents: 'write', workflows: 'write' };
    await access.of(WORKSPACE);
    vi.useRealTimers();

    const after = await access.credential(WORKSPACE);
    expect(after.password).not.toBe(before.password);
  });
});
