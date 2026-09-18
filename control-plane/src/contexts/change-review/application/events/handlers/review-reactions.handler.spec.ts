import { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import type { ReviewOutboxPort } from '@change-review/application/ports/review-outbox.port';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { ReviewCommentRemoved } from '@change-review/domain/events/review-comment-removed.event';
import { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import { ReviewCommentRewritten } from '@change-review/domain/events/review-comment-rewritten.event';
import { ReviewNotPosted } from '@change-review/domain/events/review-not-posted.event';
import { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');
const REVIEW = ReviewId.of('review_1');
const TASK = TaskId.of('task_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const ADA = UserId.of('user_ada');
const COMMENT = ReviewCommentId.of('comment_1');

const draft = (id: string) =>
  ReviewComment.drafted({
    id: ReviewCommentId.of(id),
    workspaceId: WORKSPACE,
    taskId: TASK,
    anchor: ReviewAnchor.of({ path: 'src/a.ts', side: 'new', line: 3 }),
    body: 'About line 3',
    author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
    now: NOW,
  });

const reacting = (held: readonly ReviewComment[] = []) => {
  const comments = new Map(held.map((each) => [each.id.value, each]));
  const enqueue = vi.fn(async () => {});
  const reactions = new ReviewReactions(
    {
      find: async (id: ReviewCommentId) => comments.get(id.value) ?? null,
      save: async (comment: ReviewComment) =>
        void comments.set(comment.id.value, comment),
    } as unknown as ReviewCommentRepository,
    { enqueue } as unknown as ReviewOutboxPort,
    { generate: () => 'sync_1' },
    { now: () => NOW, sleep: async () => {} },
  );

  return { reactions, comments, enqueue };
};

describe('ReviewReactions', () => {
  it('queues a submitted review for GitHub', async () => {
    const { reactions, enqueue } = reacting();

    await reactions.onSubmitted(
      new ReviewSubmitted(REVIEW, WORKSPACE, TASK, [COMMENT]),
    );

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'review', subjectId: 'review_1' }),
      NOW,
    );
  });

  it('keeps where GitHub put each comment its review holds', async () => {
    const submitted = draft('comment_1').submittedIn(REVIEW);
    const elsewhere = draft('comment_2').submittedIn(ReviewId.of('review_2'));
    const { reactions, comments } = reacting([submitted, elsewhere]);

    await reactions.onPosted(
      new ReviewPosted(REVIEW, [
        {
          commentId: submitted.id,
          github: { id: 101, url: 'https://github.com/c/101' },
        },
        {
          commentId: elsewhere.id,
          github: { id: 102, url: 'https://github.com/c/102' },
        },
      ]),
    );

    expect(comments.get('comment_1')?.github?.id).toBe(101);
    expect(comments.get('comment_2')?.github).toBeNull();
  });

  it('hands back the comments of a review that never reached GitHub', async () => {
    const held = draft('comment_1').submittedIn(REVIEW);
    const withdrawn = draft('comment_2').submittedIn(REVIEW).removed(ADA);
    const elsewhere = draft('comment_3').submittedIn(ReviewId.of('review_2'));
    const { reactions, comments } = reacting([held, withdrawn, elsewhere]);

    await reactions.onNotPosted(
      new ReviewNotPosted(
        REVIEW,
        [held.id, withdrawn.id, elsewhere.id],
        'failed',
      ),
    );

    expect(comments.get('comment_1')?.state).toBe('draft');
    expect(comments.get('comment_2')?.sending).toBe(false);
    expect(comments.get('comment_3')?.state).toBe('submitted');
  });

  it('owes GitHub an edit made while the review was on its way', async () => {
    const sending = draft('comment_1')
      .submittedIn(REVIEW)
      .rewritten('Clearer', ADA, NOW);
    sending.pullEvents();
    const { reactions, comments } = reacting([sending]);

    await reactions.onPosted(
      new ReviewPosted(REVIEW, [
        {
          commentId: sending.id,
          github: { id: 101, url: 'https://github.com/c/101' },
        },
      ]),
    );

    expect(comments.get('comment_1')?.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review-comment.rewritten',
        onGitHub: true,
      }),
    ]);
  });

  it('queues a reply, and an edit or deletion of what is already on GitHub', async () => {
    const { reactions, enqueue } = reacting();

    await reactions.onReplied(
      new ReviewCommentReplied(COMMENT, WORKSPACE, TASK),
    );
    await reactions.onRewritten(
      new ReviewCommentRewritten(COMMENT, WORKSPACE, TASK, true),
    );
    await reactions.onRemoved(
      new ReviewCommentRemoved(COMMENT, WORKSPACE, TASK, true),
    );

    expect(
      enqueue.mock.calls.map(
        (call) => (call as unknown as [{ kind: string }])[0].kind,
      ),
    ).toEqual(['reply', 'edit', 'delete']);
  });

  it('queues nothing for a draft rewritten or removed before it reached GitHub', async () => {
    const { reactions, enqueue } = reacting();

    await reactions.onRewritten(
      new ReviewCommentRewritten(COMMENT, WORKSPACE, TASK, false),
    );
    await reactions.onRemoved(
      new ReviewCommentRemoved(COMMENT, WORKSPACE, TASK, false),
    );

    expect(enqueue).not.toHaveBeenCalled();
  });
});
