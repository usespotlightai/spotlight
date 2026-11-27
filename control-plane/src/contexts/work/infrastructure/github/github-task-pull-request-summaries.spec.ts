import type {
  PullRequestSummariesPort,
  PullRequestSummaryDto,
} from '@github/application/ports/pull-request-summaries.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { GitHubTaskPullRequestSummaries } from '@work/infrastructure/github/github-task-pull-request-summaries';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const URL = 'https://github.com/acme/api/pull/7';

const summary = (
  author: string | null,
  authorIsBot = false,
): PullRequestSummaryDto => ({
  url: URL,
  state: 'merged',
  title: 'Fix the queue',
  author,
  authorIsBot,
  additions: 12,
  deletions: 3,
  changedFiles: 2,
  updatedAt: new Date('2026-11-21T10:00:00.000Z'),
});

const imageOf = async (stored: PullRequestSummaryDto) => {
  const summaries: PullRequestSummariesPort = {
    of: async () => [stored],
  };
  const found = await new GitHubTaskPullRequestSummaries(summaries).of(
    WORKSPACE,
    [PullRequestUrl.of(URL)],
  );

  return found.get(URL)?.authorImage;
};

describe('GitHubTaskPullRequestSummaries', () => {
  it('gives a person author their GitHub picture', async () => {
    await expect(imageOf(summary('octocat'))).resolves.toBe(
      'https://github.com/octocat.png?size=64',
    );
  });

  it('gives no picture to a bot author, whose login has no picture URL', async () => {
    await expect(imageOf(summary('dependabot[bot]', true))).resolves.toBeNull();
  });

  it('gives no picture when the author is not known', async () => {
    await expect(imageOf(summary(null))).resolves.toBeNull();
  });
});
