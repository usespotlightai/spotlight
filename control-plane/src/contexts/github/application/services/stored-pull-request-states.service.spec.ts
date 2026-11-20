import type {
  NumberedPullRequest,
  PullRequestStatusReaderPort,
  PullRequestWithStatus,
} from '@github/application/ports/pull-request-status-reader.port';
import { StoredPullRequestStates } from '@github/application/services/stored-pull-request-states.service';
import type { PullRequestStatus } from '@github/domain/value-objects/pull-request-state.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const urlOf = (number: number, repository = 'acme/api') =>
  PullRequestUrl.of(`https://github.com/${repository}/pull/${number}`);

const stored = (
  number: number,
  status: PullRequestStatus,
  repository = 'acme/api',
): PullRequestWithStatus => ({
  repository: Repository.of(repository),
  number,
  status,
});

const holding = (...stored: readonly PullRequestWithStatus[]) => {
  const asked: NumberedPullRequest[][] = [];
  const reader: PullRequestStatusReaderPort = {
    statusesOf: async (_, pullRequests) => {
      asked.push([...pullRequests]);
      return stored;
    },
  };

  return { reader, asked };
};

describe('StoredPullRequestStates', () => {
  it('gives each pull request the status it has stored', async () => {
    const { reader } = holding(
      stored(1, 'draft'),
      stored(2, 'open'),
      stored(3, 'merged'),
      stored(4, 'closed'),
    );

    await expect(
      new StoredPullRequestStates(reader).of(WORKSPACE, [
        urlOf(1),
        urlOf(2),
        urlOf(3),
        urlOf(4),
      ]),
    ).resolves.toEqual([
      { url: urlOf(1).value, state: 'draft' },
      { url: urlOf(2).value, state: 'open' },
      { url: urlOf(3).value, state: 'merged' },
      { url: urlOf(4).value, state: 'closed' },
    ]);
  });

  it('reads all pull requests at once and asks only for links to pull requests', async () => {
    const { reader, asked } = holding();

    await new StoredPullRequestStates(reader).of(WORKSPACE, [
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
      new StoredPullRequestStates(reader).of(WORKSPACE, [
        urlOf(1),
        urlOf(2),
        urlOf(9),
      ]),
    ).resolves.toEqual([{ url: urlOf(1).value, state: 'open' }]);
  });

  it('matches the repository whatever its case', async () => {
    const { reader } = holding(stored(1, 'open', 'Acme/API'));

    await expect(
      new StoredPullRequestStates(reader).of(WORKSPACE, [urlOf(1)]),
    ).resolves.toEqual([{ url: urlOf(1).value, state: 'open' }]);
  });
});
