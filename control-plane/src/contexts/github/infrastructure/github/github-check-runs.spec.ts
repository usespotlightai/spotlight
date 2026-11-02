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
  text: async () => String(body),
});

const RUNS = {
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

const github = (over: { logs?: number } = {}) =>
  vi.stubGlobal('fetch', async (url: string) => {
    requested.push(url);

    if (url.endsWith('/pulls/7')) {
      return answering(200, { head: { sha: 'abc123' } });
    }
    if (url.includes('/commits/abc123/check-runs')) {
      return answering(200, RUNS);
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
      return answering(over.logs ?? 200, LOG);
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
        'https://api.github.com/repos/acme/api/commits/abc123/check-runs?filter=latest&per_page=100',
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
