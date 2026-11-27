import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import { CommitPullRequests } from '@insights/infrastructure/acl/commit-pull-requests.adapter';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const SHA = '3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f';

const COMMIT = SourceCommit.of({ repository: 'acme/config', sha: SHA });

const answering = (ofCommit: PullRequestPort['ofCommit']) =>
  new CommitPullRequests(partial<PullRequestPort>({ ofCommit }));

describe('CommitPullRequests', () => {
  it('asks GitHub for the pull requests of the commit', async () => {
    const asked: string[] = [];
    const found = {
      number: 12,
      url: 'https://github.com/acme/config/pull/12',
      title: 'Tighten the claims',
      merged: true,
    };

    await expect(
      answering((workspaceId, repository, sha) => {
        asked.push(`${workspaceId.value} ${repository.value}@${sha}`);
        return Promise.resolve([found]);
      }).of(WorkspaceId.of('ws_1'), COMMIT),
    ).resolves.toEqual([found]);
    expect(asked).toEqual([`ws_1 acme/config@${SHA}`]);
  });

  it.each([
    ['no GitHub connection', new NoGitHubInstallationError()],
    [
      'GitHub refuses',
      new UpstreamError('GitHub would not list', 'No commit found', 422, false),
    ],
  ])('finds none when %s', async (_why, error) => {
    await expect(
      answering(() => Promise.reject(error)).of(WorkspaceId.of('ws_1'), COMMIT),
    ).resolves.toEqual([]);
  });

  it('lets a passing GitHub failure through, to try again', async () => {
    const failing = new UpstreamError(
      'GitHub would not list',
      'busy',
      503,
      true,
    );

    await expect(
      answering(() => Promise.reject(failing)).of(
        WorkspaceId.of('ws_1'),
        COMMIT,
      ),
    ).rejects.toBe(failing);
  });
});
