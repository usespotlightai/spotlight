import { GITHUB_PUBLICATIONS } from '@github/application/integration-events/github.publications';
import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  GITHUB_PUBLICATIONS.filter((each) => each.from === event.kind).map((each) =>
    each.publish(event),
  );

describe('GITHUB_PUBLICATIONS', () => {
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
});
