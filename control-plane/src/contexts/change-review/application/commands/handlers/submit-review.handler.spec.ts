import { SubmitReviewHandler } from '@change-review/application/commands/handlers/submit-review.handler';
import { SubmitReviewCommand } from '@change-review/application/commands/submit-review.command';
import type { ReviewAccess } from '@change-review/application/services/review-access.service';
import type { Review } from '@change-review/domain/aggregates/review.aggregate';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { ReviewCommentVersionConflictError } from '@change-review/domain/exceptions/review-comment-version-conflict.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');
const ADA = UserId.of('user_ada');
const TASK = TaskId.of('task_1');
const WORKSPACE = WorkspaceId.of('ws_1');

const draft = (id: string) =>
  ReviewComment.draft({
    id: ReviewCommentId.of(id),
    workspaceId: WORKSPACE,
    taskId: TASK,
    anchor: ReviewAnchor.onLines({ path: 'src/a.ts', side: 'new', line: 3 }),
    body: 'About line 3',
    author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
    now: NOW,
  });

const submitting = (over: { racing?: boolean } = {}) => {
  const comments = new Map([['comment_1', draft('comment_1')]]);
  const reviews: Review[] = [];
  let ids = 0;

  const handler = new SubmitReviewHandler(
    {
      ofRun: async () => ({
        task: { id: TASK, workspaceId: WORKSPACE },
        by: ADA,
        author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      }),
    } as unknown as ReviewAccess,
    {
      draftsBy: async () =>
        [...comments.values()].filter((each) => each.state === 'draft'),
      save: async (comment: ReviewComment) => {
        if (over.racing) {
          throw new ReviewCommentVersionConflictError(comment.id.value);
        }
        comments.set(comment.id.value, comment);
      },
    } as unknown as ReviewCommentRepository,
    {
      add: async (review: Review) => void reviews.push(review),
    } as unknown as ReviewRepository,
    { inTransaction: (work) => work() },
    { generate: () => `review_${++ids}` },
    { now: () => NOW, sleep: async () => {} },
  );

  return { handler, comments, reviews };
};

const command = () =>
  new SubmitReviewCommand('team_1', 'run_1', ADA.value, 'comment', '');

describe('SubmitReviewHandler', () => {
  it('claims the drafts for the review it submits', async () => {
    const { handler, comments, reviews } = submitting();

    await handler.execute(command());

    expect(reviews.map((each) => each.id.value)).toEqual(['review_1']);
    expect(comments.get('comment_1')?.reviewId?.value).toBe('review_1');
    expect(comments.get('comment_1')?.state).toBe('submitted');
  });

  it('submits the same drafts only once, however often it is asked', async () => {
    const { handler, reviews } = submitting();

    await handler.execute(command());
    await expect(handler.execute(command())).rejects.toThrow(ApplicationError);

    expect(reviews).toHaveLength(1);
  });

  it('refuses a submit that raced another for the same drafts', async () => {
    const { handler, reviews } = submitting({ racing: true });

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(reviews).toEqual([]);
  });
});
