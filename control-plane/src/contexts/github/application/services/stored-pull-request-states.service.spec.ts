import { StoredPullRequestStates } from '@github/application/services/stored-pull-request-states.service';
import { PullRequest } from '@github/domain/aggregates/pull-request.aggregate';
import type { PullRequestRepository } from '@github/domain/repositories/pull-request.repository';
import type { PullRequestState } from '@github/domain/value-objects/pull-request-state.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository as Repo } from '@shared-kernel/domain/value-objects/repository.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const OPENED = new Date('2026-11-20T08:00:00Z');

const urlOf = (number: number) =>
  PullRequestUrl.of(`https://github.com/acme/api/pull/${number}`);

const stored = (
  number: number,
  state: PullRequestState,
  draft = false,
): PullRequest =>
  PullRequest.rehydrate({
    workspaceId: WORKSPACE,
    url: urlOf(number),
    repository: Repository.of('acme/api'),
    number,
    title: `Change ${number}`,
    author: 'ada',
    authorIsBot: false,
    branch: null,
    size: null,
    openedAt: OPENED,
    draft,
    readyForReviewAt: null,
    draftPeriods: [],
    state,
    closedAt: state === 'open' ? null : OPENED,
    updatedAt: OPENED,
    reverts: null,
    reviews: [],
    dismissedReviews: [],
    comments: [],
    deletedComments: [],
    botComments: [],
    threads: [],
    revertedBy: null,
    version: 0,
  });

const holding = (
  ...pullRequests: readonly PullRequest[]
): PullRequestRepository => ({
  numbered: async (_: WorkspaceId, __: Repo, number: number) =>
    pullRequests.find((each) => each.number === number) ?? null,
  titled: async () => [],
  lastUpdatedBefore: async () => [],
  ofWorkspace: async () => [],
  lockedAt: async () => null,
  lockedUnlessBusy: async () => null,
  add: async () => {},
  save: async () => {},
  remove: async () => {},
});

describe('StoredPullRequestStates', () => {
  it('says whether each pull request is a draft, open, merged or closed', async () => {
    const states = new StoredPullRequestStates(
      holding(
        stored(1, 'open', true),
        stored(2, 'open'),
        stored(3, 'merged'),
        stored(4, 'closed'),
      ),
    );

    await expect(
      states.of(WORKSPACE, [urlOf(1), urlOf(2), urlOf(3), urlOf(4)]),
    ).resolves.toEqual([
      { url: urlOf(1).value, state: 'draft' },
      { url: urlOf(2).value, state: 'open' },
      { url: urlOf(3).value, state: 'merged' },
      { url: urlOf(4).value, state: 'closed' },
    ]);
  });

  it('leaves out pull requests it has not stored, and links that are not pull requests', async () => {
    const states = new StoredPullRequestStates(holding(stored(1, 'open')));

    await expect(
      states.of(WORKSPACE, [
        urlOf(1),
        urlOf(9),
        PullRequestUrl.of('https://github.com/acme/api/issues/2'),
      ]),
    ).resolves.toEqual([{ url: urlOf(1).value, state: 'open' }]);
  });
});
