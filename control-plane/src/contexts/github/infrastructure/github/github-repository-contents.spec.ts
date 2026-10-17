import { BranchTakenError } from '@github/application/errors/branch-taken.error';
import { RepositoryFileUnwritableError } from '@github/application/errors/repository-file-unwritable.error';
import { RepositoryUnreachableError } from '@github/application/errors/repository-unreachable.error';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubRepositoryContents } from '@github/infrastructure/github/github-repository-contents';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const access = {
  credential: vi.fn(async () => ({
    username: 'x-access-token',
    password: 'tok_1',
  })),
} as unknown as RepositoryAccessPort;

const WORKSPACE = WorkspaceId.of('ws_1');

const PLATFORM = Repository.of('acme/platform');

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

const github = (
  over: {
    unreachable?: boolean;
    branchTaken?: boolean;
    head?: string;
    large?: boolean;
    linked?: boolean;
    forbidden?: { remaining: string };
  } = {},
) =>
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';

    sent.push({
      url,
      method,
      body: init.body ? JSON.parse(String(init.body)) : {},
    });

    if (url.endsWith('/commits/trunk') && over.forbidden) {
      return {
        ...answering(403, { message: 'Forbidden' }),
        headers: new Headers({
          'x-ratelimit-remaining': over.forbidden.remaining,
        }),
      };
    }
    if (url.endsWith('/repos/acme/platform')) {
      return over.unreachable
        ? answering(404, { message: 'Not Found' })
        : answering(200, { default_branch: 'trunk' });
    }
    if (url.endsWith('/commits/trunk')) {
      return answering(200, { sha: 'commit_1' });
    }
    if (url.includes('/contents/teams/core/delivery.tf?ref=commit_1')) {
      return answering(
        200,
        over.large
          ? { type: 'file', encoding: 'none', content: '', sha: 'blob_1' }
          : {
              type: 'file',
              path: over.linked ? 'elsewhere.tf' : 'teams/core/delivery.tf',
              encoding: 'base64',
              content: Buffer.from('key = "delivery"\n').toString('base64'),
              sha: 'blob_1',
            },
      );
    }
    if (url.endsWith('/git/blobs/blob_1')) {
      return answering(200, {
        content: Buffer.from('big = true\n').toString('base64'),
      });
    }
    if (url.includes('/contents/')) {
      return answering(404, { message: 'Not Found' });
    }
    if (url.endsWith('/git/commits/commit_1')) {
      return answering(200, { tree: { sha: 'tree_1' } });
    }
    if (url.endsWith('/git/blobs') && method === 'POST') {
      return answering(201, { sha: `blob_${sent.length}` });
    }
    if (url.endsWith('/git/trees/tree_1')) {
      return answering(200, {
        tree: [
          { path: 'teams', type: 'tree', mode: '040000', sha: 'tree_teams' },
        ],
      });
    }
    if (url.endsWith('/git/trees/tree_teams')) {
      return answering(200, {
        tree: [
          { path: 'core', type: 'tree', mode: '040000', sha: 'tree_core' },
        ],
      });
    }
    if (url.endsWith('/git/trees/tree_core')) {
      return answering(200, {
        tree: [
          { path: 'delivery.tf', type: 'blob', mode: '100644', sha: 'b1' },
          { path: 'run.sh', type: 'blob', mode: '100755', sha: 'b2' },
          { path: 'linked.tf', type: 'blob', mode: '120000', sha: 'b3' },
        ],
      });
    }
    if (url.endsWith('/git/trees')) {
      return answering(201, { sha: 'tree_2' });
    }
    if (url.endsWith('/git/commits') && method === 'POST') {
      return answering(201, { sha: 'commit_2' });
    }
    if (url.endsWith('/git/refs') && method === 'POST') {
      return over.branchTaken
        ? answering(422, { message: 'Reference already exists' })
        : answering(201, { ref: 'refs/heads/x' });
    }
    if (url.includes('/git/ref/heads/')) {
      return answering(200, { object: { sha: over.head ?? 'commit_9' } });
    }
    if (url.includes('/git/refs/heads/') && method === 'PATCH') {
      return answering(200, { ref: 'refs/heads/x' });
    }

    return answering(500, { message: `unrouted ${method} ${url}` });
  });

const contents = () => new GitHubRepositoryContents(access);

describe('GitHubRepositoryContents', () => {
  beforeEach(() => {
    sent = [];
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reads a file at the head of the default branch, saying which commit it read', async () => {
    github();

    expect(
      await contents().fileAt(WORKSPACE, PLATFORM, 'teams/core/delivery.tf'),
    ).toEqual({
      content: 'key = "delivery"\n',
      blobSha: 'blob_1',
      commit: 'commit_1',
      defaultBranch: 'trunk',
    });
  });

  it('reads a file too large to inline through its blob', async () => {
    github({ large: true });

    expect(
      (await contents().fileAt(WORKSPACE, PLATFORM, 'teams/core/delivery.tf'))
        ?.content,
    ).toBe('big = true\n');
  });

  it('answers nothing for a file the repository does not have', async () => {
    github();

    expect(
      await contents().fileAt(WORKSPACE, PLATFORM, 'teams/none.tf'),
    ).toBeNull();
  });

  it('refuses a repository the installation cannot reach', async () => {
    github({ unreachable: true });

    await expect(
      contents().fileAt(WORKSPACE, PLATFORM, 'teams/core/delivery.tf'),
    ).rejects.toBeInstanceOf(RepositoryUnreachableError);
  });

  it('commits files on top of the base and opens the branch on it', async () => {
    github();

    expect(
      await contents().committed(WORKSPACE, PLATFORM, {
        branch: 'spotlight/search-1',
        base: 'commit_1',
        replacing: null,
        message: 'Change build',
        files: [
          { path: 'teams/core/delivery.tf', content: 'a\n' },
          { path: 'teams/core/prompts/build.md', content: 'b\n' },
        ],
      }),
    ).toBe('commit_2');

    const tree = sent.find((each) => each.url.endsWith('/git/trees'));
    const commit = sent.find(
      (each) => each.url.endsWith('/git/commits') && each.method === 'POST',
    );

    expect(tree?.body.base_tree).toBe('tree_1');
    expect(
      ((tree?.body.tree ?? []) as { path: string }[]).map((each) => each.path),
    ).toEqual(['teams/core/delivery.tf', 'teams/core/prompts/build.md']);
    expect(commit?.body).toEqual({
      message: 'Change build',
      tree: 'tree_2',
      parents: ['commit_1'],
    });
    expect(sent.find((each) => each.url.endsWith('/git/refs'))?.body).toEqual({
      ref: 'refs/heads/spotlight/search-1',
      sha: 'commit_2',
    });
  });

  it('moves a branch onto the new commit only from the commit Spotlight last wrote there', async () => {
    github({ branchTaken: true, head: 'commit_mine' });

    await contents().committed(WORKSPACE, PLATFORM, {
      branch: 'spotlight/search-1',
      base: 'commit_1',
      replacing: 'commit_mine',
      message: 'Change build',
      files: [{ path: 'teams/core/delivery.tf', content: 'a\n' }],
    });

    expect(sent.find((each) => each.method === 'PATCH')).toMatchObject({
      url: 'https://api.github.com/repos/acme/platform/git/refs/heads/spotlight/search-1',
      body: { sha: 'commit_2', force: true },
    });
  });

  it('refuses to move a branch that has commits Spotlight did not write', async () => {
    github({ branchTaken: true, head: 'commit_theirs' });

    await expect(
      contents().committed(WORKSPACE, PLATFORM, {
        branch: 'spotlight/search-1',
        base: 'commit_1',
        replacing: 'commit_mine',
        message: 'Change build',
        files: [{ path: 'teams/core/delivery.tf', content: 'a\n' }],
      }),
    ).rejects.toBeInstanceOf(BranchTakenError);
    expect(sent.some((each) => each.method === 'PATCH')).toBe(false);
  });

  it('keeps an executable file executable and refuses a symbolic link', async () => {
    github();

    await contents().committed(WORKSPACE, PLATFORM, {
      branch: 'spotlight/search-1',
      base: 'commit_1',
      replacing: null,
      message: 'Change build',
      files: [
        { path: 'teams/core/run.sh', content: 'a\n' },
        { path: 'teams/core/new.md', content: 'b\n' },
      ],
    });

    expect(
      sent.find((each) => each.url.endsWith('/git/trees'))?.body.tree,
    ).toMatchObject([
      { path: 'teams/core/run.sh', mode: '100755' },
      { path: 'teams/core/new.md', mode: '100644' },
    ]);
    await expect(
      contents().committed(WORKSPACE, PLATFORM, {
        branch: 'spotlight/search-1',
        base: 'commit_1',
        replacing: null,
        message: 'Change build',
        files: [{ path: 'teams/core/linked.tf', content: 'a\n' }],
      }),
    ).rejects.toBeInstanceOf(RepositoryFileUnwritableError);

    github({ linked: true });
    await expect(
      contents().fileAt(WORKSPACE, PLATFORM, 'teams/core/delivery.tf'),
    ).rejects.toBeInstanceOf(RepositoryFileUnwritableError);
  });

  it('says whether a refusal is worth trying again', async () => {
    github({ forbidden: { remaining: '12' } });

    await expect(
      contents().fileAt(WORKSPACE, PLATFORM, 'teams/core/delivery.tf'),
    ).rejects.toMatchObject({ status: 403, retryable: false });

    github({ forbidden: { remaining: '0' } });

    await expect(
      contents().fileAt(WORKSPACE, PLATFORM, 'teams/core/delivery.tf'),
    ).rejects.toMatchObject({ status: 403, retryable: true });
  });
});
