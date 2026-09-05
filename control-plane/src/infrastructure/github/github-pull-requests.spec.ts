import type { PullRequestProposal } from '@application/ports/pull-request.port';
import type { RepositoryAccessPort } from '@application/ports/repository-access.port';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { GitHubPullRequests } from '@infrastructure/github/github-pull-requests';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const access = {
  credential: vi.fn(async () => ({
    username: 'x-access-token',
    password: 'tok_1',
  })),
} as unknown as RepositoryAccessPort;

const proposal: PullRequestProposal = {
  installation: GitHubInstallation.of('42'),
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

/** The repository as GitHub would answer for it, branch by branch. */
const repository = (over: { open?: boolean; branch?: boolean } = {}) =>
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
    if (url.endsWith('/pulls')) {
      return answering(201, { html_url: 'https://github.com/acme/api/pull/9' });
    }

    return answering(404, { message: `unrouted ${url}` });
  });

const asked = (fragment: string) =>
  sent.filter((each) => each.url.includes(fragment));

/** The last of them, which is the one a sequence of calls ends on. */
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
          { path: '.spotlight/lines/default.yml', text: 'name: Default\n' },
        ],
      });

      expect(asked('/git/blobs')).toHaveLength(2);
      expect(asked('/git/commits')).toHaveLength(1);
      expect(asked('/git/trees')[0]?.body.tree).toHaveLength(2);
    });

    // Branched from where it will be merged, so the diff is only ours.
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

    // Proposing twice should amend what is open, not collide with it.
    it('writes on top of a branch that is already standing', async () => {
      repository({ branch: true, open: true });

      await new GitHubPullRequests(access).propose(proposal);

      expect(asked('/git/commits')[0]?.body.parents).toEqual(['branch_sha']);
      expect(asked('/git/refs/heads/')[0]?.method).toBe('PATCH');
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

  describe('opening one for a branch a run pushed', () => {
    it('opens it against the default branch', async () => {
      repository();

      expect(
        await new GitHubPullRequests(access).open({
          installation: proposal.installation,
          repository: proposal.repository,
          branch: 'spotlight/task_1',
          title: 'Fix the queue',
          body: 'why',
        }),
      ).toEqual({ url: 'https://github.com/acme/api/pull/9' });

      expect(lastly('/pulls')?.body.base).toBe('trunk');
    });

    // A run has already pushed it; nothing here writes a commit.
    it('writes no commit of its own', async () => {
      repository();

      await new GitHubPullRequests(access).open({
        installation: proposal.installation,
        repository: proposal.repository,
        branch: 'spotlight/task_1',
        title: 'Fix the queue',
        body: 'why',
      });

      expect(asked('/git/')).toHaveLength(0);
    });
  });
});
