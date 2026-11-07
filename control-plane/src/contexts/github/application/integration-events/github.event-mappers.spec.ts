import { GITHUB_EVENT_MAPPERS } from '@github/application/integration-events/github.event-mappers';
import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { PullRequestPurged } from '@github/domain/events/pull-request-purged.event';
import { PullRequestReopened } from '@github/domain/events/pull-request-reopened.event';
import { PullRequestReviewed } from '@github/domain/events/pull-request-reviewed.event';
import { PullRequestUpdated } from '@github/domain/events/pull-request-updated.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import { BotComment } from '@github/domain/value-objects/bot-comment.vo';
import { DraftPeriod } from '@github/domain/value-objects/draft-period.vo';
import { PullRequestReview } from '@github/domain/value-objects/pull-request-review.vo';
import { PullRequestThread } from '@github/domain/value-objects/pull-request-thread.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const PULL_7 = PullRequestUrl.of('https://github.com/acme/api/pull/7');

const ACME_API = Repository.of('acme/api');

const published = (event: DomainEvent) =>
  GITHUB_EVENT_MAPPERS.filter((each) => each.from === event.kind).map((each) =>
    each.map(event, new Date()),
  );

describe('GITHUB_EVENT_MAPPERS', () => {
  it('publishes a received review comment as plain data', () => {
    expect(
      published(
        new ReviewCommentReceived(WorkspaceId.of('ws_1'), 'edited', PULL_7, {
          id: 300,
          url: 'https://github.com/acme/api/pull/7#discussion_r300',
          path: 'src/a.ts',
          subject: 'line',
          side: 'old',
          line: 12,
          startLine: null,
          body: 'Why not a constant?',
          inReplyToId: 200,
          login: 'octocat',
          writtenAt: new Date('2026-09-16T09:00:00Z'),
        }),
      ),
    ).toEqual([
      {
        kind: 'github.review-comment-received.v1',
        workspaceId: 'ws_1',
        action: 'edited',
        pullRequest: 'https://github.com/acme/api/pull/7',
        commentId: 300,
        url: 'https://github.com/acme/api/pull/7#discussion_r300',
        path: 'src/a.ts',
        subject: 'line',
        side: 'old',
        line: 12,
        startLine: null,
        body: 'Why not a constant?',
        inReplyToId: 200,
        login: 'octocat',
        writtenAt: '2026-09-16T09:00:00.000Z',
      },
    ]);
  });

  it('publishes a merged pull request with the commit it made', () => {
    expect(
      published(
        new PullRequestClosed(
          WorkspaceId.of('ws_1'),
          PULL_7,
          ACME_API,
          707,
          { commit: 'c'.repeat(40) },
          new Date('2026-09-21T09:30:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'github.pull-request-closed.v1',
        workspaceId: 'ws_1',
        pullRequest: 'https://github.com/acme/api/pull/7',
        repository: 'acme/api',
        gitHubId: 707,
        merged: true,
        mergeCommit: 'c'.repeat(40),
        closedAt: '2026-09-21T09:30:00.000Z',
      },
    ]);
  });

  it('publishes a reopened pull request with its GitHub id', () => {
    expect(
      published(
        new PullRequestReopened(
          WorkspaceId.of('ws_1'),
          PULL_7,
          ACME_API,
          707,
          new Date('2026-09-22T09:30:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'github.pull-request-reopened.v1',
        workspaceId: 'ws_1',
        pullRequest: 'https://github.com/acme/api/pull/7',
        repository: 'acme/api',
        gitHubId: 707,
        reopenedAt: '2026-09-22T09:30:00.000Z',
      },
    ]);
  });

  it('publishes a submitted review, who wrote it and when', () => {
    expect(
      published(
        new PullRequestReviewed(
          WorkspaceId.of('ws_1'),
          PULL_7,
          'approved',
          'ada',
          false,
          new Date('2026-09-21T09:30:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'github.pull-request-reviewed.v1',
        workspaceId: 'ws_1',
        pullRequest: 'https://github.com/acme/api/pull/7',
        state: 'approved',
        login: 'ada',
        byBot: false,
        submittedAt: '2026-09-21T09:30:00.000Z',
      },
    ]);
  });

  it('publishes a close without a merge as naming no commit', () => {
    expect(
      published(
        new PullRequestClosed(
          WorkspaceId.of('ws_1'),
          PULL_7,
          ACME_API,
          null,
          null,
          null,
        ),
      ),
    ).toMatchObject([{ merged: false, mergeCommit: null, closedAt: null }]);
  });
  it('publishes what a pull request now is, with what GitHub saw of its reviews, as plain data', () => {
    expect(
      published(
        new PullRequestUpdated(WorkspaceId.of('ws_1'), {
          pullRequest: PULL_7,
          repository: ACME_API,
          number: 7,
          title: 'Retry failed uploads',
          author: 'ada',
          authorIsBot: false,
          branch: 'fix/uploads',
          additions: 40,
          deletions: 3,
          changedFiles: 2,
          openedAt: new Date('2026-09-20T08:00:00Z'),
          state: 'merged',
          closedAt: new Date('2026-09-21T09:00:00Z'),
          updatedAt: new Date('2026-09-21T09:05:00Z'),
          readyForReviewAt: new Date('2026-09-20T10:00:00Z'),
          draftPeriods: [
            DraftPeriod.of({
              from: new Date('2026-09-20T12:00:00Z'),
              to: new Date('2026-09-20T14:00:00Z'),
            }),
          ],
          reviews: [
            PullRequestReview.of({
              id: 1,
              state: 'commented',
              login: 'coderabbitai[bot]',
              byBot: true,
              at: new Date('2026-09-20T11:00:00Z'),
            }),
            PullRequestReview.of({
              id: 2,
              state: 'approved',
              login: 'grace',
              byBot: false,
              at: null,
            }),
          ],
          dismissedReviews: [2],
          reviewComments: 1,
          botComments: [
            BotComment.of({
              id: 10,
              on: 'line',
              login: 'coderabbitai[bot]',
              opensThread: true,
              deleted: false,
            }),
          ],
          threads: [
            PullRequestThread.of({
              id: 'PRRT_1',
              firstCommentId: 10,
              login: 'coderabbitai[bot]',
              byBot: true,
              resolved: true,
            }),
          ],
          isRevert: true,
          revertedBy: PullRequestUrl.of('https://github.com/acme/api/pull/9'),
          version: 3,
        }),
      ),
    ).toEqual([
      {
        kind: 'github.pull-request-updated.v1',
        workspaceId: 'ws_1',
        pullRequest: 'https://github.com/acme/api/pull/7',
        repository: 'acme/api',
        number: 7,
        title: 'Retry failed uploads',
        author: 'ada',
        authorIsBot: false,
        branch: 'fix/uploads',
        additions: 40,
        deletions: 3,
        changedFiles: 2,
        openedAt: '2026-09-20T08:00:00.000Z',
        state: 'merged',
        closedAt: '2026-09-21T09:00:00.000Z',
        updatedAt: '2026-09-21T09:05:00.000Z',
        readyForReviewAt: '2026-09-20T10:00:00.000Z',
        draftPeriods: [
          {
            from: '2026-09-20T12:00:00.000Z',
            to: '2026-09-20T14:00:00.000Z',
          },
        ],
        reviews: [
          {
            id: 1,
            state: 'commented',
            login: 'coderabbitai[bot]',
            byBot: true,
            submittedAt: '2026-09-20T11:00:00.000Z',
            dismissed: false,
          },
          {
            id: 2,
            state: 'approved',
            login: 'grace',
            byBot: false,
            submittedAt: null,
            dismissed: true,
          },
        ],
        reviewComments: 1,
        botComments: [
          {
            id: 10,
            on: 'line',
            login: 'coderabbitai[bot]',
            opensThread: true,
            deleted: false,
          },
        ],
        threads: [
          {
            id: 'PRRT_1',
            firstCommentId: 10,
            login: 'coderabbitai[bot]',
            byBot: true,
            resolved: true,
          },
        ],
        isRevert: true,
        revertedBy: 'https://github.com/acme/api/pull/9',
        version: 3,
      },
    ]);
  });

  it('publishes a purged pull request with when GitHub last changed it', () => {
    expect(
      published(
        new PullRequestPurged(
          WorkspaceId.of('ws_1'),
          PULL_7,
          new Date('2026-03-01T10:00:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'github.pull-request-purged.v1',
        workspaceId: 'ws_1',
        pullRequest: 'https://github.com/acme/api/pull/7',
        updatedAt: '2026-03-01T10:00:00.000Z',
      },
    ]);
  });
});
