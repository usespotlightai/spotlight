import type { PullRequestOpening } from '@github/application/ports/pull-request.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubPullRequests } from '@github/infrastructure/github/github-pull-requests';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const access = {
  credential: vi.fn(async () => ({
    username: 'x-access-token',
    password: 'tok_1',
  })),
} as unknown as RepositoryAccessPort;

const opening: PullRequestOpening = {
  workspaceId: WorkspaceId.of('ws_1'),
  repository: Repository.of('acme/api'),
  branch: 'spotlight/task_1',
  title: 'Fix the queue',
  body: 'why',
};

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly body: Record<string, unknown>;
}

let sent: Sent[] = [];

const answering = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

const repository = (over: { open?: boolean; taken?: boolean } = {}) =>
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    sent.push({
      url,
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(String(init.body)) : {},
    });

    if (url.endsWith('/repos/acme/api')) {
      return answering(200, { default_branch: 'trunk' });
    }
    if (url.includes('/pulls?state=open')) {
      return answering(
        200,
        over.open
          ? [
              {
                html_url: 'https://github.com/acme/api/pull/3',
                number: 3,
                id: 303,
                base: { repo: { full_name: 'Acme/API' } },
              },
            ]
          : [],
      );
    }
    if (url.endsWith('/pulls/3')) {
      return answering(200, {
        html_url: 'https://github.com/acme/api/pull/3',
        state: 'closed',
        merged: false,
        closed_at: '2026-10-28T09:00:00Z',
      });
    }
    if (url.endsWith('/pulls/5')) {
      return answering(200, {
        state: 'closed',
        merged: true,
        merged_at: '2026-10-28T10:00:00Z',
      });
    }
    if (url.endsWith('/pulls/6')) {
      return answering(200, { state: 'open', merged: false });
    }
    if (url.endsWith('/issues/3/comments')) {
      return answering(201, { id: 1 });
    }
    if (url.endsWith('/pulls') && over.taken) {
      return answering(422, {
        errors: [
          {
            message: 'A pull request already exists for acme:spotlight/task_1.',
          },
        ],
      });
    }
    if (url.endsWith('/pulls')) {
      return answering(201, {
        html_url: 'https://github.com/acme/api/pull/9',
        number: 9,
        id: 909,
        base: { repo: { full_name: 'Acme/API' } },
      });
    }

    return answering(404, { message: `unrouted ${url}` });
  });

const sentTo = (fragment: string) =>
  sent.filter((each) => each.url.includes(fragment));

const lastly = (fragment: string): Sent | undefined => {
  const all = sentTo(fragment);

  return all[all.length - 1];
};

describe('GitHubPullRequests', () => {
  beforeEach(() => {
    sent = [];
    vi.clearAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  describe('opening one for a branch a run pushed', () => {
    it('opens it against the default branch', async () => {
      repository();

      expect(await new GitHubPullRequests(access).open(opening)).toEqual({
        url: 'https://github.com/acme/api/pull/9',
        number: 9,
        id: 909,
        repository: 'Acme/API',
      });

      expect(lastly('/pulls')?.body.base).toBe('trunk');
    });

    it('answers with the one already open when GitHub says the branch has one', async () => {
      repository({ open: true, taken: true });

      expect(await new GitHubPullRequests(access).open(opening)).toEqual({
        url: 'https://github.com/acme/api/pull/3',
        number: 3,
        id: 303,
        repository: 'Acme/API',
      });
    });

    it('carries GitHub’s error where nothing is open for the branch after all', async () => {
      repository({ open: false, taken: true });

      await expect(
        new GitHubPullRequests(access).open(opening),
      ).rejects.toThrow(/already exists/);
    });

    it('writes no commit of its own', async () => {
      repository();

      await new GitHubPullRequests(access).open(opening);

      expect(sentTo('/git/')).toHaveLength(0);
    });
  });

  describe('editing one', () => {
    const editing = (
      body: string | null,
      link = 'https://github.com/acme/api/pull/3',
    ) => ({
      workspaceId: WorkspaceId.of('ws_1'),
      pullRequest: PullRequestUrl.of(link),
      title: 'Fix the queue, twice',
      body,
    });

    it('changes its title and body', async () => {
      repository();

      await new GitHubPullRequests(access).edit(editing('what changed'));

      expect(sent).toEqual([
        {
          url: 'https://api.github.com/repos/acme/api/pulls/3',
          method: 'PATCH',
          body: { title: 'Fix the queue, twice', body: 'what changed' },
        },
      ]);
    });

    it('leaves its body where none is handed over', async () => {
      repository();

      await new GitHubPullRequests(access).edit(editing(null));

      expect(lastly('/pulls/3')?.body).toEqual({
        title: 'Fix the queue, twice',
      });
    });

    it('rejects a link that names no pull request', async () => {
      repository();

      await expect(
        new GitHubPullRequests(access).edit(
          editing(null, 'https://github.com/acme/api'),
        ),
      ).rejects.toThrow(/is not a GitHub pull request/);
      expect(sent).toEqual([]);
    });

    it('carries GitHub’s error', async () => {
      repository();

      await expect(
        new GitHubPullRequests(access).edit(
          editing(null, 'https://github.com/acme/api/pull/4'),
        ),
      ).rejects.toThrow(/would not edit/);
    });
  });

  describe('closing one', () => {
    const at = (number = 3) => ({
      workspaceId: WorkspaceId.of('ws_1'),
      repository: Repository.of('acme/api'),
      number,
    });

    it('closes it', async () => {
      repository();

      await new GitHubPullRequests(access).close(at());

      expect(sent).toEqual([
        {
          url: 'https://api.github.com/repos/acme/api/pulls/3',
          method: 'PATCH',
          body: { state: 'closed' },
        },
      ]);
    });

    it('comments on it', async () => {
      repository();

      await new GitHubPullRequests(access).comment(
        at(),
        'Spotlight closed this pull request.',
      );

      expect(sent).toEqual([
        {
          url: 'https://api.github.com/repos/acme/api/issues/3/comments',
          method: 'POST',
          body: { body: 'Spotlight closed this pull request.' },
        },
      ]);
    });

    it('carries GitHub’s error when it would not close it', async () => {
      repository();

      await expect(new GitHubPullRequests(access).close(at(4))).rejects.toThrow(
        /would not close acme\/api#4/,
      );
    });
  });

  describe('reading its status', () => {
    const at = (number: number) => ({
      workspaceId: WorkspaceId.of('ws_1'),
      repository: Repository.of('acme/api'),
      number,
    });

    it('says whether it is open, closed or merged, and when it ended', async () => {
      repository();
      const pullRequests = new GitHubPullRequests(access);

      expect(await pullRequests.statusOf(at(6))).toEqual({
        state: 'open',
        closedAt: null,
      });
      expect(await pullRequests.statusOf(at(3))).toEqual({
        state: 'closed',
        closedAt: new Date('2026-10-28T09:00:00Z'),
      });
      expect(await pullRequests.statusOf(at(5))).toEqual({
        state: 'merged',
        closedAt: new Date('2026-10-28T10:00:00Z'),
      });
    });
  });

  describe('saying what changed', () => {
    const files = (from: number, count: number) =>
      Array.from({ length: count }, (_, at) => ({
        filename: `src/file-${from + at}.ts`,
      }));

    const changing = (pages: Record<number, unknown>) =>
      vi.stubGlobal('fetch', async (url: string) => {
        sent.push({ url, method: 'GET', body: {} });

        if (url.endsWith('/repos/acme/api')) {
          return answering(200, { default_branch: 'trunk' });
        }

        const page = Number(new URL(url).searchParams.get('page'));

        return page in pages
          ? answering(200, pages[page])
          : answering(404, { message: 'Not Found' });
      });

    it('compares a branch with the default branch, page after page', async () => {
      changing({
        1: { files: files(0, 100) },
        2: { files: files(100, 20) },
      });

      const changed = await new GitHubPullRequests(access).changedOn(
        WorkspaceId.of('ws_1'),
        Repository.of('acme/api'),
        'spotlight/task_1',
      );

      expect(changed).toHaveLength(120);
      expect(changed[0]).toBe('src/file-0.ts');
      expect(sentTo('/compare/trunk...spotlight/task_1')).toHaveLength(2);
    });

    it('stops at 3000 files', async () => {
      changing(
        Object.fromEntries(
          Array.from({ length: 40 }, (_, at) => [
            at + 1,
            { files: files(at * 100, 100) },
          ]),
        ),
      );

      const changed = await new GitHubPullRequests(access).changedOn(
        WorkspaceId.of('ws_1'),
        Repository.of('acme/api'),
        'spotlight/task_1',
      );

      expect(changed).toHaveLength(3_000);
      expect(sentTo('/compare/')).toHaveLength(30);
    });

    it('stops when a page names nothing new', async () => {
      changing({ 1: { files: files(0, 100) }, 2: { files: files(0, 100) } });

      const changed = await new GitHubPullRequests(access).changedOn(
        WorkspaceId.of('ws_1'),
        Repository.of('acme/api'),
        'spotlight/task_1',
      );

      expect(changed).toHaveLength(100);
      expect(sentTo('/compare/')).toHaveLength(2);
    });

    it('lists the files of a pull request', async () => {
      changing({ 1: files(0, 100), 2: files(100, 1) });

      const changed = await new GitHubPullRequests(access).changedIn(
        WorkspaceId.of('ws_1'),
        Repository.of('acme/api'),
        PullRequestUrl.of('https://github.com/acme/api/pull/9'),
      );

      expect(changed).toHaveLength(101);
      expect(sentTo('/repos/acme/api/pulls/9/files')).toHaveLength(2);
    });

    it('rejects a link that names no pull request', async () => {
      changing({});

      await expect(
        new GitHubPullRequests(access).changedIn(
          WorkspaceId.of('ws_1'),
          Repository.of('acme/api'),
          PullRequestUrl.of('https://github.com/acme/api'),
        ),
      ).rejects.toThrow(/is not a GitHub pull request/);
    });

    it('carries GitHub’s error', async () => {
      changing({});

      await expect(
        new GitHubPullRequests(access).changedOn(
          WorkspaceId.of('ws_1'),
          Repository.of('acme/api'),
          'spotlight/task_1',
        ),
      ).rejects.toThrow(/Not Found/);
    });
  });
});
