import { generateKeyPairSync } from 'node:crypto';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { GitHubInstallationAdministration } from '@github/infrastructure/github/github-installation.administration';
import type { Env } from '@platform/config/env.schema';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const env = {
  GITHUB_APP_ID: '1',
  GITHUB_APP_PRIVATE_KEY: privateKey.export({
    type: 'pkcs1',
    format: 'pem',
  }) as string,
} as Env;

const LEON = UserId.of('user_leon');
const INSTALLED = GitHubInstallation.of('42');

type Answer = { status: number; body?: unknown };

const ORG = {
  status: 200,
  body: { account: { id: 900, login: 'acme', type: 'Organization' } },
};
const PERSONAL = {
  status: 200,
  body: { account: { id: 7, login: 'leon', type: 'User' } },
};

const github = (routes: Record<string, Answer>) => {
  const fetching = vi.fn(async (url: string) => {
    const path = String(url).replace('https://api.github.com', '');
    const answer = routes[path] ?? { status: 404, body: {} };

    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => answer.body,
    };
  });
  vi.stubGlobal('fetch', fetching);

  return fetching;
};

const administration = (token: string | null = 'gho_live') =>
  new GitHubInstallationAdministration(env, {
    tokenFor: vi.fn(async () => token),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitHubInstallationAdministration', () => {
  it('finds an admin of the organisation the installation belongs to', async () => {
    const fetching = github({
      '/app/installations/42': ORG,
      '/user/memberships/orgs/acme': {
        status: 200,
        body: { state: 'active', role: 'admin' },
      },
    });

    expect(await administration().of(INSTALLED, LEON)).toBe('administers');
    const [, init] = fetching.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers.authorization).not.toBe('Bearer gho_live');
  });

  it('refuses a plain member of the organisation', async () => {
    github({
      '/app/installations/42': ORG,
      '/user/memberships/orgs/acme': {
        status: 200,
        body: { state: 'active', role: 'member' },
      },
    });

    expect(await administration().of(INSTALLED, LEON)).toBe('does-not');
  });

  it('refuses an admin whose membership is still pending', async () => {
    github({
      '/app/installations/42': ORG,
      '/user/memberships/orgs/acme': {
        status: 200,
        body: { state: 'pending', role: 'admin' },
      },
    });

    expect(await administration().of(INSTALLED, LEON)).toBe('does-not');
  });

  it('refuses a read-only collaborator who can see the installation', async () => {
    github({
      '/app/installations/42': ORG,
      '/user/installations': {
        status: 200,
        body: { installations: [{ id: 42 }] },
      },
      '/user/memberships/orgs/acme': { status: 404, body: {} },
    });

    expect(await administration().of(INSTALLED, LEON)).toBe('does-not');
  });

  it('finds the owner of a personal account', async () => {
    github({
      '/app/installations/42': PERSONAL,
      '/user': { status: 200, body: { id: 7, login: 'leon' } },
    });

    expect(await administration().of(INSTALLED, LEON)).toBe('administers');
  });

  it('refuses somebody else on a personal account', async () => {
    github({
      '/app/installations/42': PERSONAL,
      '/user': { status: 200, body: { id: 8, login: 'mallory' } },
    });

    expect(await administration().of(INSTALLED, LEON)).toBe('does-not');
  });

  it('cannot tell when GitHub fails', async () => {
    github({
      '/app/installations/42': ORG,
      '/user/memberships/orgs/acme': { status: 502, body: {} },
    });

    expect(await administration().of(INSTALLED, LEON)).toBe('cannot-tell');
  });

  it('cannot tell when GitHub fails to describe the installation', async () => {
    github({ '/app/installations/42': { status: 500, body: {} } });

    expect(await administration().of(INSTALLED, LEON)).toBe('cannot-tell');
  });

  it('refuses an installation GitHub does not know', async () => {
    github({});

    expect(await administration().of(INSTALLED, LEON)).toBe('does-not');
  });

  it('cannot tell without a linked GitHub account', async () => {
    github({ '/app/installations/42': ORG });

    expect(await administration(null).of(INSTALLED, LEON)).toBe('cannot-tell');
  });
});
