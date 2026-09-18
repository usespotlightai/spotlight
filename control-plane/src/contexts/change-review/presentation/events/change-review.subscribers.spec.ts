import type { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import type { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import type { ChangeStackAnnouncerPort } from '@change-review/application/ports/change-stack-announcer.port';
import type { ForgetTaskAcrossAggregates } from '@change-review/application/services/forget-task-across-aggregates.service';
import type { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import { changeReviewSubscribers } from '@change-review/presentation/events/change-review.subscribers';
import type { ReviewCommentReceivedIntegrationEvent } from '@github/application/integration-events/review-comment-received.integration-event';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const RECEIVED: ReviewCommentReceivedIntegrationEvent = {
  kind: 'github.review-comment-received.v1',
  workspaceId: 'ws_1',
  action: 'created',
  pullRequest: 'https://github.com/acme/api/pull/7',
  commentId: 300,
  url: 'https://github.com/acme/api/pull/7#discussion_r300',
  path: 'src/a.ts',
  side: 'old',
  line: 4,
  startLine: null,
  body: 'Why not a constant?',
  answers: null,
  login: 'octocat',
  writtenAt: '2026-09-16T09:00:00.000Z',
};

const hearing = () => {
  const receive = vi.fn(async () => {});
  const subscriber = changeReviewSubscribers(
    {} as unknown as ChangeStackReactions,
    {} as unknown as ChangeStackAnnouncerPort,
    {} as unknown as ForgetTaskAcrossAggregates,
    {} as unknown as ReviewReactions,
    { receive } as unknown as ReceiveReviewComment,
  ).find((each) => each.kinds.includes(RECEIVED.kind));

  if (!subscriber) {
    throw new Error('nobody hears a review comment');
  }

  return { subscriber, receive };
};

describe('change review hearing a review comment on GitHub', () => {
  it('receives it in the workspace GitHub named', async () => {
    const { subscriber, receive } = hearing();

    await subscriber.handle(RECEIVED);

    expect(receive).toHaveBeenCalledWith({
      workspaceId: WorkspaceId.of('ws_1'),
      action: 'created',
      pullRequest: 'https://github.com/acme/api/pull/7',
      comment: {
        id: 300,
        url: 'https://github.com/acme/api/pull/7#discussion_r300',
        path: 'src/a.ts',
        side: 'old',
        line: 4,
        startLine: null,
        body: 'Why not a constant?',
        answers: null,
        login: 'octocat',
        writtenAt: new Date('2026-09-16T09:00:00.000Z'),
      },
    });
  });

  it('receives one GitHub gave no time', async () => {
    const { subscriber, receive } = hearing();

    const unwritten: ReviewCommentReceivedIntegrationEvent = {
      ...RECEIVED,
      writtenAt: null,
    };

    await subscriber.handle(unwritten);

    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({
        comment: expect.objectContaining({ writtenAt: null }),
      }),
    );
  });
});
