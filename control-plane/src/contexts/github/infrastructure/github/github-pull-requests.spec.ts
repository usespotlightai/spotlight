import type { PullRequestProposal } from '@github/application/ports/pull-request.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubPullRequests } from '@github/infrastructure/github/github-pull-requests';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const access = {
  credential: vi.fn(async () => ({
    username: 'x-access-token',
    password: 'tok_1',
  })),
} as unknown as RepositoryAccessPort;

const proposal: PullRequestProposal = {
  workspaceId: WorkspaceId.of('ws_1'),
  repository: Repository.of('acme/api'),
  branch: 'spotlight/config',
  title: 'Set up Spotlight',
  body: 'The line as it stands today.',
  message: 'Add .spotlight/config.yml',
  files: [{ path: '.spotlight/config.yml', text: 'version: 1\n' }],
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

const repository = (
  over: { open?: boolean; branch?: boolean; taken?: boolean } = {},
) =>
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    sent.push({
      url,
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(String(init.body)) : {},
    });

    if (url.endsWith('/repos/acme/api')) {
      return answering(200, { default_branch: 'trunk' });
    }
    if (url.includes('/git/ref/heads/trunk')) {
      return answering(200, { object: { sha: 'base_sha' } });
    }
    if (url.includes('/git/ref/heads/spotlight%2Fconfig')) {
      return over.branch
        ? answering(200, { object: { sha: 'branch_sha' } })
        : answering(404, { message: 'Not Found' });
    }
    if (url.includes('/git/blobs')) {
      return answering(201, { sha: 'blob_sha' });
    }
    if (url.includes('/git/trees')) {
      return answering(201, { sha: 'tree_sha' });
    }
    if (url.includes('/git/commits')) {
      return answering(201, { sha: 'commit_sha' });
    }
    if (url.includes('/git/refs')) {
      return answering(201, { ref: 'refs/heads/spotlight/config' });
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

  describe('proposing a change of its own', () => {
    it('opens a pull request for the files it was given', async () => {
      repository();

      expect(await new GitHubPullRequests(access).propose(proposal)).toEqual({
        url: 'https://github.com/acme/api/pull/9',
      });
    });

    it('writes every file into one commit', async () => {
      repository();

      await new GitHubPullRequests(access).propose({
        ...proposal,
        files: [
          { path: '.spotlight/config.yml', text: 'version: 1\n' },
          {
            path: '.spotlight/lines/default/line.yml',
            text: 'name: Default\n',
          },
        ],
      });

      expect(asked('/git/blobs')).toHaveLength(2);
      expect(asked('/git/commits')).toHaveLength(1);
      expect(asked('/git/trees')[0]?.body.tree).toHaveLength(2);
    });

    it('branches from the branch it will be merged into', async () => {
      repository();

      await new GitHubPullRequests(access).propose(proposal);

      expect(asked('/git/trees')[0]?.body.base_tree).toBe('base_sha');
      expect(asked('/git/commits')[0]?.body.parents).toEqual(['base_sha']);
      expect(lastly('/pulls')?.body.base).toBe('trunk');
    });

    it('creates the branch where there is not one yet', async () => {
      repository();

      await new GitHubPullRequests(access).propose(proposal);

      const [made] = asked('/git/refs');
      expect(made?.method).toBe('POST');
      expect(made?.body.ref).toBe('refs/heads/spotlight/config');
    });

    it('writes on top of a branch that is already standing', async () => {
      repository({ branch: true, open: true });

      await new GitHubPullRequests(access).propose(proposal);

      expect(asked('/git/commits')[0]?.body.parents).toEqual(['branch_sha']);
      expect(asked('/git/refs/heads/')[0]?.method).toBe('PATCH');
    });

    it('starts again from the branch it merges into once the pull request on its branch has merged', async () => {
      repository({ branch: true, open: false });

      expect(await new GitHubPullRequests(access).propose(proposal)).toEqual({
        url: 'https://github.com/acme/api/pull/9',
      });
      expect(asked('/git/commits')[0]?.body.parents).toEqual(['base_sha']);
      expect(asked('/git/trees')[0]?.body.base_tree).toBe('base_sha');
      const [moved] = asked('/git/refs/heads/');
      expect(moved?.method).toBe('PATCH');
      expect(moved?.body.force).toBe(true);
    });

    it('answers with the pull request already open rather than a second', async () => {
      repository({ branch: true, open: true });

      expect(await new GitHubPullRequests(access).propose(proposal)).toEqual({
        url: 'https://github.com/acme/api/pull/3',
      });
      expect(sent.filter((each) => each.url.endsWith('/pulls'))).toHaveLength(
        0,
      );
    });

    it('refuses a proposal that would change nothing', async () => {
      repository();

      await expect(
        new GitHubPullRequests(access).propose({ ...proposal, files: [] }),
      ).rejects.toThrow(UpstreamRefusedError);
      expect(sent).toHaveLength(0);
    });

    it('carries GitHub’s own reason for refusing', async () => {
      vi.stubGlobal('fetch', async () =>
        answering(422, { errors: [{ message: 'Reference already exists' }] }),
      );

      await expect(
        new GitHubPullRequests(access).propose(proposal),
      ).rejects.toThrow(/Reference already exists/);
    });
  });

  describe('the pull request open on a branch', () => {
    it('is the one GitHub has open for it', async () => {
      repository({ open: true });

      expect(
        await new GitHubPullRequests(access).openFor(
          proposal.workspaceId,
          proposal.repository,
          'spotlight/config',
        ),
      ).toEqual({ url: 'https://github.com/acme/api/pull/3' });
    });

    it('is none where GitHub has none open', async () => {
      repository({ open: false });

      expect(
        await new GitHubPullRequests(access).openFor(
          proposal.workspaceId,
          proposal.repository,
          'spotlight/config',
        ),
      ).toBeNull();
    });
  });

  describe('opening one for a branch a run pushed', () => {
    it('opens it against the default branch', async () => {
      repository();

      expect(
        await new GitHubPullRequests(access).open({
          workspaceId: proposal.workspaceId,
          repository: proposal.repository,
          branch: 'spotlight/task_1',
          title: 'Fix the queue',
          body: 'why',
        }),
      ).toEqual({ url: 'https://github.com/acme/api/pull/9' });

      expect(lastly('/pulls')?.body.base).toBe('trunk');
    });

    it('answers with the one already open when GitHub says the branch has one', async () => {
      repository({ open: true, taken: true });

      expect(
        await new GitHubPullRequests(access).open({
          workspaceId: proposal.workspaceId,
          repository: proposal.repository,
          branch: 'spotlight/task_1',
          title: 'Fix the queue',
          body: 'why',
        }),
      ).toEqual({ url: 'https://github.com/acme/api/pull/3' });
    });

    it('carries GitHub’s refusal where nothing is open for the branch after all', async () => {
      repository({ open: false, taken: true });

      await expect(
        new GitHubPullRequests(access).open({
          workspaceId: proposal.workspaceId,
          repository: proposal.repository,
          branch: 'spotlight/task_1',
          title: 'Fix the queue',
          body: 'why',
        }),
      ).rejects.toThrow(/already exists/);
    });

    it('writes no commit of its own', async () => {
      repository();

      await new GitHubPullRequests(access).open({
        workspaceId: proposal.workspaceId,
        repository: proposal.repository,
        branch: 'spotlight/task_1',
        title: 'Fix the queue',
        body: 'why',
      });

      expect(asked('/git/')).toHaveLength(0);
    });
  });
});
