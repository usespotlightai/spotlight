import { GITHUB_PUBLICATIONS } from '@github/application/integration-events/github.publications';
import { DefaultBranchPushed } from '@github/domain/events/default-branch-pushed.event';
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

  it('publishes a push to the default branch with the paths it touched', () => {
    expect(
      published(
        new DefaultBranchPushed(WorkspaceId.of('ws_1'), 'acme/api', [
          '.spotlight/config.yml',
        ]),
      ),
    ).toEqual([
      {
        kind: 'github.default-branch-pushed.v1',
        workspaceId: 'ws_1',
        repository: 'acme/api',
        paths: ['.spotlight/config.yml'],
      },
    ]);
  });
});
