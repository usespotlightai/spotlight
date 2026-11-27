import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { GitHubReachableInstallations } from '@github/infrastructure/github/github-reachable-installations';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

const LEON = UserId.of('user_leon');

const installed = (id: number, login: string) => ({
  id,
  account: { login, type: 'Organization' },
});

const github = (pages: Record<number, { status: number; body: unknown }>) => {
  const fetching = vi.fn(async (url: string) => {
    const page = Number(new URL(url).searchParams.get('page'));
    const answer = pages[page] ?? { status: 200, body: { installations: [] } };

    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      headers: new Headers(),
      json: async () => answer.body,
    };
  });
  vi.stubGlobal('fetch', fetching);

  return fetching;
};

const reachable = (token: string | null = 'ghu_leon') =>
  new GitHubReachableInstallations({ tokenFor: vi.fn(async () => token) });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitHubReachableInstallations', () => {
  it('lists the installations of the App that the person can reach, with their own token', async () => {
    const fetching = github({
      1: {
        status: 200,
        body: {
          installations: [installed(42, 'zeta'), installed(7, 'acme')],
        },
      },
    });

    await expect(reachable().of(LEON)).resolves.toEqual([
      { installation: GitHubInstallation.of('7'), account: 'acme' },
      { installation: GitHubInstallation.of('42'), account: 'zeta' },
    ]);
    const [url, init] = fetching.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe(
      'https://api.github.com/user/installations?per_page=100&page=1',
    );
    expect(init.headers.authorization).toBe('Bearer ghu_leon');
  });

  it('reads every page', async () => {
    const full = Array.from({ length: 100 }, (_, at) =>
      installed(at + 1, `org-${String(at).padStart(3, '0')}`),
    );
    const fetching = github({
      1: { status: 200, body: { installations: full } },
      2: { status: 200, body: { installations: [installed(500, 'zz')] } },
    });

    await expect(reachable().of(LEON)).resolves.toHaveLength(101);
    expect(fetching).toHaveBeenCalledTimes(2);
  });

  it('leaves out an installation without an account', async () => {
    github({
      1: {
        status: 200,
        body: { installations: [{ id: 3, account: null }, installed(4, 'a')] },
      },
    });

    await expect(reachable().of(LEON)).resolves.toEqual([
      { installation: GitHubInstallation.of('4'), account: 'a' },
    ]);
  });

  it('lists nothing and asks GitHub nothing without a GitHub sign-in', async () => {
    const fetching = github({});

    await expect(reachable(null).of(LEON)).resolves.toEqual([]);
    expect(fetching).not.toHaveBeenCalled();
  });

  it('says GitHub failed where it will not list them', async () => {
    github({ 1: { status: 401, body: { message: 'Bad credentials' } } });

    await expect(reachable().of(LEON)).rejects.toBeInstanceOf(UpstreamError);
  });
});
