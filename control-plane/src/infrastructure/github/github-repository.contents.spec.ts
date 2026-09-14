import type { RepositoryAccessPort } from '@application/ports/repository-access.port';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { GitHubRepositoryContents } from '@infrastructure/github/github-repository.contents';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const access = {
  credential: vi.fn(async () => ({
    username: 'x-access-token',
    password: 'tok_1',
  })),
} as unknown as RepositoryAccessPort;

const reading = {
  installation: GitHubInstallation.of('42'),
  repository: Repository.of('acme/api'),
  ref: 'main',
  path: '.spotlight',
};

const answering = (
  status: number,
  body: unknown,
): { status: number; ok: boolean; json: () => Promise<unknown> } => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

const blob = (text: string) => ({
  content: Buffer.from(text, 'utf8').toString('base64'),
  encoding: 'base64',
});

let called: string[] = [];

const serving = (route: (url: string) => unknown) => {
  vi.stubGlobal('fetch', async (url: string) => {
    called.push(url);
    return route(url);
  });
};

describe('GitHubRepositoryContents', () => {
  beforeEach(() => {
    called = [];
    vi.clearAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  describe('reading one file', () => {
    it('reads it at the ref it was asked for', async () => {
      serving(() =>
        answering(200, { type: 'file', size: 12, ...blob('version: 1') }),
      );

      const found = await new GitHubRepositoryContents(access).read({
        ...reading,
        path: '.spotlight/config.yml',
      });

      expect(found).toEqual({
        path: '.spotlight/config.yml',
        text: 'version: 1',
      });
      expect(called[0]).toContain('/contents/.spotlight/config.yml?ref=main');
    });

    it('reads nothing where the repository holds none', async () => {
      serving(() => answering(404, { message: 'Not Found' }));

      expect(
        await new GitHubRepositoryContents(access).read(reading),
      ).toBeNull();
    });

    it('reads nothing where the path names a directory', async () => {
      serving(() => answering(200, { type: 'dir' }));

      expect(
        await new GitHubRepositoryContents(access).read(reading),
      ).toBeNull();
    });

    it('refuses a file nobody would have written by hand', async () => {
      serving(() =>
        answering(200, { type: 'file', size: 9_000_000, ...blob('x') }),
      );

      await expect(
        new GitHubRepositoryContents(access).read(reading),
      ).rejects.toThrow(UpstreamRefusedError);
    });

    it('carries GitHub’s own reason for refusing', async () => {
      serving(() => answering(403, { message: 'Resource not accessible' }));

      await expect(
        new GitHubRepositoryContents(access).read(reading),
      ).rejects.toThrow(/Resource not accessible/);
    });
  });

  describe('reading a directory', () => {
    const tree = {
      truncated: false,
      tree: [
        { path: 'README.md', type: 'blob', sha: 'b0', size: 4 },
        {
          path: '.spotlight/integrations/linear.yml',
          type: 'blob',
          sha: 'b2',
          size: 4,
        },
        { path: '.spotlight/config.yml', type: 'blob', sha: 'b1', size: 4 },
        { path: '.spotlight/lines', type: 'tree', sha: 't1' },
      ],
    };

    const routed = (url: string) =>
      url.includes('/git/trees/')
        ? answering(200, tree)
        : answering(200, blob(`body of ${url.split('/').pop()}`));

    it('reads every file beneath it, however deep, in a stable order', async () => {
      serving(routed);

      const found = await new GitHubRepositoryContents(access).under(reading);

      expect(found.map((each) => each.path)).toEqual([
        '.spotlight/config.yml',
        '.spotlight/integrations/linear.yml',
      ]);
      expect(found[0]?.text).toBe('body of b1');
    });

    it('reads nothing outside the directory it was asked for', async () => {
      serving(routed);

      const found = await new GitHubRepositoryContents(access).under(reading);

      expect(found.map((each) => each.path)).not.toContain('README.md');
    });

    it('reads no directories, only what is in them', async () => {
      serving(routed);

      const found = await new GitHubRepositoryContents(access).under(reading);

      expect(found.map((each) => each.path)).not.toContain('.spotlight/lines');
    });

    it('reads nothing where the ref has no tree at all', async () => {
      serving(() => answering(404, { message: 'Not Found' }));

      expect(await new GitHubRepositoryContents(access).under(reading)).toEqual(
        [],
      );
    });

    it('refuses a listing GitHub had to cut short', async () => {
      serving(() => answering(200, { truncated: true, tree: [] }));

      await expect(
        new GitHubRepositoryContents(access).under(reading),
      ).rejects.toThrow(/too large/);
    });

    it('mints one credential for the whole directory', async () => {
      serving(routed);

      await new GitHubRepositoryContents(access).under(reading);

      expect(access.credential).toHaveBeenCalledTimes(1);
    });
  });
});
