import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { GitHubCheckRuns } from '@github/infrastructure/github/github-check-runs';
import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const PULL_REQUEST = PullRequestUrl.of('https://github.com/acme/api/pull/7');

const access = {
  credential: vi.fn(async () => ({
    username: 'x-access-token',
    password: 'tok_1',
  })),
} as unknown as RepositoryAccessPort;

const answering = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: new Headers(),
  json: async () => body,
});

const RUNS = {
  total_count: 3,
  check_runs: [
    {
      id: 11,
      name: 'web / build',
      conclusion: 'failure',
      html_url: 'https://github.com/acme/api/actions/runs/1/job/11',
      app: { slug: 'github-actions' },
      output: { title: null, summary: null },
    },
    {
      id: 12,
      name: 'web / test',
      conclusion: 'success',
      app: { slug: 'github-actions' },
    },
    {
      id: 13,
      name: 'CodeQL',
      conclusion: 'failure',
      html_url: 'https://github.com/acme/api/runs/13',
      app: { slug: 'github-advanced-security' },
      output: { title: '1 new alert', summary: 'Use of a weak hash.' },
    },
  ],
};

const LOG = [
  '2026-11-02T10:00:00.0000000Z ##[group]Run npm run build',
  '2026-11-02T10:00:01.0000000Z src/app.ts(3,1): error TS2322',
  '2026-11-02T10:00:02.0000000Z ##[error]Process completed with exit code 2.',
].join('\n');

const requested: string[] = [];

const github = (
  over: { logs?: number; unreachable?: boolean; runs?: typeof RUNS } = {},
) =>
  vi.stubGlobal('fetch', async (url: string) => {
    requested.push(url);

    if (over.unreachable && url.includes('/actions/jobs/')) {
      throw new TypeError('fetch failed');
    }

    if (url.endsWith('/pulls/7')) {
      return answering(200, { head: { sha: 'abc123' } });
    }
    if (url.includes('/commits/abc123/check-runs')) {
      return answering(200, over.runs ?? RUNS);
    }
    if (url.includes('/check-suites/42/check-runs')) {
      return answering(200, RUNS);
    }
    if (url.endsWith('/actions/jobs/11')) {
      return answering(200, {
        steps: [
          { name: 'Install', conclusion: 'success' },
          { name: 'Build', conclusion: 'failure' },
        ],
      });
    }
    if (url.endsWith('/actions/jobs/11/logs')) {
      return new Response(LOG, { status: over.logs ?? 200 });
    }

    return answering(404, { message: 'Not Found' });
  });

afterEach(() => {
  vi.unstubAllGlobals();
  requested.length = 0;
});

describe('GitHubCheckRuns', () => {
  describe('the failed checks on a pull request', () => {
    it('reads the checks on the head commit, with the failed step and the end of the log of each Actions job', async () => {
      github();

      expect(
        await new GitHubCheckRuns(access).failedOn(WORKSPACE, PULL_REQUEST),
      ).toEqual({
        commit: 'abc123',
        failed: [
          {
            name: 'web / build',
            conclusion: 'failure',
            url: 'https://github.com/acme/api/actions/runs/1/job/11',
            step: 'Build',
            summary: null,
            log: [
              '##[group]Run npm run build',
              'src/app.ts(3,1): error TS2322',
              '##[error]Process completed with exit code 2.',
            ].join('\n'),
          },
          {
            name: 'CodeQL',
            conclusion: 'failure',
            url: 'https://github.com/acme/api/runs/13',
            step: null,
            summary: '1 new alert\n\nUse of a weak hash.',
            log: null,
          },
        ],
      });
      expect(requested).toContain(
        'https://api.github.com/repos/acme/api/commits/abc123/check-runs?filter=latest&per_page=100&page=1',
      );
    });

    it('still names a failed job whose log GitHub would not hand over', async () => {
      github({ logs: 403 });

      const { failed } = await new GitHubCheckRuns(access).failedOn(
        WORKSPACE,
        PULL_REQUEST,
      );

      expect(failed[0]).toMatchObject({ name: 'web / build', log: null });
    });

    it('still names a failed job when GitHub cannot be reached for its step or log', async () => {
      github({ unreachable: true });

      const { failed } = await new GitHubCheckRuns(access).failedOn(
        WORKSPACE,
        PULL_REQUEST,
      );

      expect(failed[0]).toMatchObject({
        name: 'web / build',
        step: null,
        log: null,
      });
    });

    it('reads every page of checks', async () => {
      const passed = Array.from({ length: 100 }, (_, index) => ({
        id: 100 + index,
        name: `test ${index}`,
        conclusion: 'success',
      }));
      vi.stubGlobal('fetch', async (url: string) => {
        requested.push(url);

        if (url.endsWith('/pulls/7')) {
          return answering(200, { head: { sha: 'abc123' } });
        }

        return answering(200, {
          total_count: 101,
          check_runs: url.endsWith('&page=1')
            ? passed
            : [{ id: 99, name: 'lint', conclusion: 'failure' }],
        });
      });

      const { failed } = await new GitHubCheckRuns(access).failedOn(
        WORKSPACE,
        PULL_REQUEST,
      );

      expect(failed.map((each) => each.name)).toEqual(['lint']);
    });

    it('keeps the end of a long log', async () => {
      const lines = Array.from(
        { length: 5_000 },
        (_, index) => `line ${index}`,
      );
      vi.stubGlobal('fetch', async (url: string) =>
        url.endsWith('/logs')
          ? new Response(lines.join('\n'))
          : url.endsWith('/pulls/7')
            ? answering(200, { head: { sha: 'abc123' } })
            : url.endsWith('/actions/jobs/11')
              ? answering(200, { steps: [] })
              : answering(200, RUNS),
      );

      const { failed } = await new GitHubCheckRuns(access).failedOn(
        WORKSPACE,
        PULL_REQUEST,
      );
      const log = failed[0]?.log?.split('\n') ?? [];

      expect(log).toHaveLength(200);
      expect(log[log.length - 1]).toBe('line 4999');
    });

    it('refuses a pull request that is not on GitHub', async () => {
      await expect(
        new GitHubCheckRuns(access).failedOn(
          WORKSPACE,
          PullRequestUrl.of('https://gitlab.com/acme/api/-/merge_requests/7'),
        ),
      ).rejects.toThrow(InvalidPullRequestError);
    });
  });

  it('names the failed checks of a check suite', async () => {
    github();

    expect(
      await new GitHubCheckRuns(access).failedInSuite(
        WORKSPACE,
        Repository.of('acme/api'),
        42,
      ),
    ).toEqual(['web / build', 'CodeQL']);
  });
});
