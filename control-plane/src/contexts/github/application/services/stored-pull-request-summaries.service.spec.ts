import type {
  NumberedPullRequest,
  PullRequestSummaryReaderPort,
  StoredPullRequestSummary,
} from '@github/application/ports/pull-request-summary-reader.port';
import { StoredPullRequestSummaries } from '@github/application/services/stored-pull-request-summaries.service';
import type { PullRequestStatus } from '@github/domain/value-objects/pull-request-state.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const UPDATED_AT = new Date('2026-11-21T10:00:00.000Z');

const urlOf = (number: number, repository = 'acme/api') =>
  PullRequestUrl.of(`https://github.com/${repository}/pull/${number}`);

const stored = (
  number: number,
  state: PullRequestStatus,
  repository = 'acme/api',
): StoredPullRequestSummary => ({
  repository: Repository.of(repository),
  number,
  state,
  title: `Change ${number}`,
  author: 'octocat',
  authorIsBot: false,
  additions: 12,
  deletions: 3,
  changedFiles: 2,
  updatedAt: UPDATED_AT,
});

const summaryOf = (number: number, state: PullRequestStatus) => ({
  url: urlOf(number).value,
  state,
  title: `Change ${number}`,
  author: 'octocat',
  authorIsBot: false,
  additions: 12,
  deletions: 3,
  changedFiles: 2,
  updatedAt: UPDATED_AT,
});

const holding = (...stored: readonly StoredPullRequestSummary[]) => {
  const asked: NumberedPullRequest[][] = [];
  const reader: PullRequestSummaryReaderPort = {
    summariesOf: async (_, pullRequests) => {
      asked.push([...pullRequests]);
      return stored;
    },
  };

  return { reader, asked };
};

describe('StoredPullRequestSummaries', () => {
  it('gives each pull request the summary it has stored', async () => {
    const { reader } = holding(
      stored(1, 'draft'),
      stored(2, 'open'),
      stored(3, 'merged'),
      stored(4, 'closed'),
    );

    await expect(
      new StoredPullRequestSummaries(reader).of(WORKSPACE, [
        urlOf(1),
        urlOf(2),
        urlOf(3),
        urlOf(4),
      ]),
    ).resolves.toEqual([
      summaryOf(1, 'draft'),
      summaryOf(2, 'open'),
      summaryOf(3, 'merged'),
      summaryOf(4, 'closed'),
    ]);
  });

  it('reads all pull requests at once and asks only for links to pull requests', async () => {
    const { reader, asked } = holding();

    await new StoredPullRequestSummaries(reader).of(WORKSPACE, [
      urlOf(1),
      PullRequestUrl.of('https://github.com/acme/api/issues/2'),
      urlOf(3, 'acme/web'),
    ]);

    expect(asked).toHaveLength(1);
    expect(
      asked[0]?.map((each) => `${each.repository.value}#${each.number}`),
    ).toEqual(['acme/api#1', 'acme/web#3']);
  });

  it('leaves out pull requests it has not stored', async () => {
    const { reader } = holding(
      stored(1, 'open'),
      stored(2, 'merged', 'acme/web'),
    );

    await expect(
      new StoredPullRequestSummaries(reader).of(WORKSPACE, [
        urlOf(1),
        urlOf(2),
        urlOf(9),
      ]),
    ).resolves.toEqual([summaryOf(1, 'open')]);
  });

  it('matches the repository whatever its case', async () => {
    const { reader } = holding(stored(1, 'open', 'Acme/API'));

    await expect(
      new StoredPullRequestSummaries(reader).of(WORKSPACE, [urlOf(1)]),
    ).resolves.toEqual([summaryOf(1, 'open')]);
  });
});
