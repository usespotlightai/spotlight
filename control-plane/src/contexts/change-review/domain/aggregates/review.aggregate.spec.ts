import { Review } from '@change-review/domain/aggregates/review.aggregate';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';

import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-16T10:00:00Z');
const ADA = UserId.of('user_ada');
const BOB = UserId.of('user_bob');
const TASK = TaskId.of('task_1');

const draftBy = (author: UserId, id = 'comment_1', task = TASK) =>
  ReviewComment.draft({
    id: ReviewCommentId.of(id),
    workspaceId: WorkspaceId.of('workspace_1'),
    taskId: task,
    anchor: ReviewAnchor.onLines({ path: 'src/a.ts', side: 'new', line: 3 }),
    body: 'Rename this',
    author: ReviewAuthor.person(author, AuthorName.of('Someone')),
    now: NOW,
  });

const submit = (over: {
  verdict?: string;
  body?: string;
  drafts?: ReviewComment[];
  author?: ReviewAuthor;
}) =>
  Review.submit({
    id: ReviewId.of('review_1'),
    workspaceId: WorkspaceId.of('workspace_1'),
    taskId: TASK,
    author: over.author ?? ReviewAuthor.person(ADA, AuthorName.of('Ada')),
    verdict: over.verdict ?? 'comment',
    body: over.body ?? '',
    drafts: over.drafts ?? [],
    now: NOW,
  }).review;

describe('Review', () => {
  it('is submitted by someone in Spotlight, never by somebody on GitHub', () => {
    expect(() =>
      submit({ author: ReviewAuthor.onGitHub('octocat'), body: 'Hi' }),
    ).toThrow(InvalidReviewError);
  });

  it('submits its author’s drafts with it', () => {
    const review = submit({
      verdict: 'request-changes',
      drafts: [draftBy(ADA, 'comment_1'), draftBy(ADA, 'comment_2')],
    });

    expect(review.state).toBe('submitted');
    expect(review.comments.map((each) => each.value)).toEqual([
      'comment_1',
      'comment_2',
    ]);
    expect(review.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review.submitted',
        comments: review.comments,
      }),
    ]);
  });

  it('refuses drafts that another review already contains, so a second submit posts nothing twice', () => {
    const claimed = draftBy(ADA).submittedIn(ReviewId.of('review_0'));

    expect(() => submit({ drafts: [claimed] })).toThrow(InvalidReviewError);
  });

  it('is posted once only', () => {
    const posted = submit({ verdict: 'approve' }).postedAs(99, NOW);

    expect(() => posted.postedAs(100, NOW)).toThrow(InvalidReviewError);
  });

  it('approves with nothing else to say', () => {
    expect(submit({ verdict: 'approve' }).verdict).toBe('approve');
  });

  it('refuses a comment or request for changes that says nothing', () => {
    expect(() => submit({ verdict: 'comment' })).toThrow(InvalidReviewError);
    expect(() => submit({ verdict: 'request-changes' })).toThrow(
      InvalidReviewError,
    );
    expect(submit({ verdict: 'comment', body: 'Looks close' }).body).toBe(
      'Looks close',
    );
  });

  it('refuses someone else’s drafts, or another task’s', () => {
    expect(() => submit({ drafts: [draftBy(BOB)] })).toThrow(
      InvalidReviewError,
    );
    expect(() =>
      submit({ drafts: [draftBy(ADA, 'comment_1', TaskId.of('task_2'))] }),
    ).toThrow(InvalidReviewError);
  });

  it('refuses a verdict GitHub has no word for', () => {
    expect(() => submit({ verdict: 'reject', body: 'No' })).toThrow(
      InvalidReviewError,
    );
  });

  it('is posted once GitHub gives it a number', () => {
    const posted = submit({ verdict: 'approve' }).postedAs(99, NOW);

    expect(posted.state).toBe('posted');
    expect(posted.githubId).toBe(99);
  });

  it('says where GitHub put each comment it placed, one by one', () => {
    const review = submit({ drafts: [draftBy(ADA)] });
    review.pullEvents();
    const github = { id: 101, url: 'https://github.com/c/101' };

    const posted = review.postedAs(99, NOW, [
      { commentId: ReviewCommentId.of('comment_1'), github },
    ]);

    expect(posted.pullEvents()).toEqual([
      expect.objectContaining({ kind: 'review.posted' }),
      expect.objectContaining({
        kind: 'review.comment-placed',
        commentId: ReviewCommentId.of('comment_1'),
        github,
      }),
    ]);
  });

  it('fails to post once, handing its comments back', () => {
    const review = submit({ drafts: [draftBy(ADA)] });
    review.pullEvents();
    const failed = review.failedToPost();

    expect(failed.state).toBe('failed');
    expect(failed.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review.comment-not-posted',
        commentId: ReviewCommentId.of('comment_1'),
      }),
    ]);
    expect(failed.failedToPost()).toBe(failed);
    expect(() => failed.postedAs(99, NOW)).toThrow(InvalidReviewError);
  });

  it('is withdrawn only once every comment it contained is gone and it says nothing else', () => {
    const review = submit({ drafts: [draftBy(ADA)] });
    const submitted = draftBy(ADA).submittedIn(review.id);
    review.pullEvents();

    expect(review.silentWith([submitted])).toBe(false);
    expect(() => review.withdraw([submitted])).toThrow(InvalidReviewError);
    expect(review.silentWith([])).toBe(true);

    const withdrawn = review.withdraw([]);

    expect(withdrawn.state).toBe('withdrawn');
    expect(withdrawn.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review.comment-not-posted',
        commentId: ReviewCommentId.of('comment_1'),
      }),
    ]);
    expect(
      submit({ verdict: 'approve', drafts: [draftBy(ADA)] }).silentWith([]),
    ).toBe(false);
    expect(
      submit({ body: 'Overall fine', drafts: [draftBy(ADA)] }).silentWith([]),
    ).toBe(false);
  });
});
