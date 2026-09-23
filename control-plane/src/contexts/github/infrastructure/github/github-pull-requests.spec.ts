import type { PullRequestOpening } from '@github/application/ports/pull-request.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubPullRequests } from '@github/infrastructure/github/github-pull-requests';
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
        over.open ? [{ html_url: 'https://github.com/acme/api/pull/3' }] : [],
      );
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
      return answering(201, { html_url: 'https://github.com/acme/api/pull/9' });
    }

    return answering(404, { message: `unrouted ${url}` });
  });

const asked = (fragment: string) =>
  sent.filter((each) => each.url.includes(fragment));

const lastly = (fragment: string): Sent | undefined => {
  const all = asked(fragment);

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
      });

      expect(lastly('/pulls')?.body.base).toBe('trunk');
    });

    it('answers with the one already open when GitHub says the branch has one', async () => {
      repository({ open: true, taken: true });

      expect(await new GitHubPullRequests(access).open(opening)).toEqual({
        url: 'https://github.com/acme/api/pull/3',
      });
    });

    it('carries GitHub’s refusal where nothing is open for the branch after all', async () => {
      repository({ open: false, taken: true });

      await expect(
        new GitHubPullRequests(access).open(opening),
      ).rejects.toThrow(/already exists/);
    });

    it('writes no commit of its own', async () => {
      repository();

      await new GitHubPullRequests(access).open(opening);

      expect(asked('/git/')).toHaveLength(0);
    });
  });
});
