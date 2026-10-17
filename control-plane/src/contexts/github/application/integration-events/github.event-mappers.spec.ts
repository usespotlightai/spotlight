import { GITHUB_EVENT_MAPPERS } from '@github/application/integration-events/github.event-mappers';
import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { PullRequestForgotten } from '@github/domain/events/pull-request-forgotten.event';
import { PullRequestRecorded } from '@github/domain/events/pull-request-recorded.event';
import { PullRequestReviewed } from '@github/domain/events/pull-request-reviewed.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  GITHUB_EVENT_MAPPERS.filter((each) => each.from === event.kind).map((each) =>
    each.map(event, new Date()),
  );

describe('GITHUB_EVENT_MAPPERS', () => {
  it('publishes a received review comment as plain data', () => {
    expect(
      published(
        new ReviewCommentReceived(
          WorkspaceId.of('ws_1'),
          'edited',
          'https://github.com/acme/api/pull/7',
          {
            id: 300,
            url: 'https://github.com/acme/api/pull/7#discussion_r300',
            path: 'src/a.ts',
            subject: 'line',
            side: 'old',
            line: 12,
            startLine: null,
            body: 'Why not a constant?',
            answers: 200,
            login: 'octocat',
            writtenAt: new Date('2026-09-16T09:00:00Z'),
          },
        ),
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
        answers: 200,
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
          'https://github.com/acme/api/pull/7',
          'acme/api',
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
        merged: true,
        mergeCommit: 'c'.repeat(40),
        closedAt: '2026-09-21T09:30:00.000Z',
      },
    ]);
  });

  it('publishes a submitted review, who wrote it and when', () => {
    expect(
      published(
        new PullRequestReviewed(
          WorkspaceId.of('ws_1'),
          'https://github.com/acme/api/pull/7',
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
          'https://github.com/acme/api/pull/7',
          'acme/api',
          null,
          null,
        ),
      ),
    ).toMatchObject([{ merged: false, mergeCommit: null, closedAt: null }]);
  });
  it('publishes what a pull request now is as plain data, owned by a task or not', () => {
    expect(
      published(
        new PullRequestRecorded(WorkspaceId.of('ws_1'), {
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
          openedAt: new Date('2026-09-20T08:00:00Z'),
          state: 'merged',
          closedAt: new Date('2026-09-21T09:00:00Z'),
          updatedAt: new Date('2026-09-21T09:05:00Z'),
          readyForReviewAt: new Date('2026-09-20T10:00:00Z'),
          draftSpells: [
            {
              from: new Date('2026-09-20T12:00:00Z'),
              to: new Date('2026-09-20T14:00:00Z'),
            },
          ],
          firstReviewAt: null,
          firstUnblockingReviewAt: new Date('2026-09-20T11:00:00Z'),
          firstApprovedAt: null,
          humanReviewedAt: [new Date('2026-09-20T12:00:00Z')],
          reviews: 0,
          reviewRounds: 0,
          reviewComments: 0,
          botActivity: [
            {
              login: 'coderabbitai[bot]',
              reviews: 1,
              comments: 2,
              threads: 1,
              resolvedThreads: 1,
            },
          ],
          isRevert: false,
          revertedBy: null,
          version: 3,
        }),
      ),
    ).toEqual([
      {
        kind: 'github.pull-request-recorded.v1',
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
        draftSpells: [
          {
            from: '2026-09-20T12:00:00.000Z',
            to: '2026-09-20T14:00:00.000Z',
          },
        ],
        firstReviewAt: null,
        firstUnblockingReviewAt: '2026-09-20T11:00:00.000Z',
        firstApprovedAt: null,
        humanReviewedAt: ['2026-09-20T12:00:00.000Z'],
        reviews: 0,
        reviewRounds: 0,
        reviewComments: 0,
        botActivity: [
          {
            login: 'coderabbitai[bot]',
            reviews: 1,
            comments: 2,
            threads: 1,
            resolvedThreads: 1,
          },
        ],
        isRevert: false,
        revertedBy: null,
        version: 3,
      },
    ]);
  });

  it('publishes a forgotten pull request with when GitHub last changed it', () => {
    expect(
      published(
        new PullRequestForgotten(
          WorkspaceId.of('ws_1'),
          'https://github.com/acme/api/pull/7',
          new Date('2026-03-01T10:00:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'github.pull-request-forgotten.v1',
        workspaceId: 'ws_1',
        pullRequest: 'https://github.com/acme/api/pull/7',
        updatedAt: '2026-03-01T10:00:00.000Z',
      },
    ]);
  });
});
