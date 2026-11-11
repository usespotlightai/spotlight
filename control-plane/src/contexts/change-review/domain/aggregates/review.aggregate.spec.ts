import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import {
  Review,
  type ReviewVerdict,
} from '@change-review/domain/aggregates/review.aggregate';
import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
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

const draftBy = (
  author: UserId,
  id = 'comment_1',
  task = TASK,
  repository: string | null = null,
) =>
  ReviewComment.draft({
    id: ReviewCommentId.of(id),
    workspaceId: WorkspaceId.of('workspace_1'),
    taskId: task,
    anchor: ReviewAnchor.onLines({
      repository: RepositoryName.optional(repository),
      path: 'src/a.ts',
      side: 'new',
      line: 3,
    }),
    body: 'Rename this',
    author: ReviewAuthor.person(author, AuthorName.of('Someone')),
    now: NOW,
  });

const posting = (
  githubId: number,
  verdictOnGitHub: ReviewVerdict = 'approve',
) => ({
  githubId,
  verdictOnGitHub,
  comments: [],
  onLinesOnGitHub: [],
  now: NOW,
});

const UNREACHABLE = DeliveryFailure.of('github-unreachable');

const submit = (over: {
  verdict?: string;
  body?: string;
  drafts?: ReviewComment[];
  author?: ReviewAuthor;
  repository?: string;
}) =>
  Review.submit({
    id: ReviewId.of('review_1'),
    workspaceId: WorkspaceId.of('workspace_1'),
    taskId: TASK,
    repository: RepositoryName.optional(over.repository),
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

  it('takes only the drafts of its own repository, and those that name none', () => {
    const review = submit({
      repository: 'docs',
      drafts: [
        draftBy(ADA, 'comment_web', TASK, 'web'),
        draftBy(ADA, 'comment_docs', TASK, 'Docs'),
        draftBy(ADA, 'comment_unnamed'),
      ],
    });

    expect(review.repository?.value).toBe('docs');
    expect(review.comments.map((each) => each.value)).toEqual([
      'comment_docs',
      'comment_unnamed',
    ]);
  });

  it('takes the drafts of every repository when it names none', () => {
    const review = submit({
      drafts: [
        draftBy(ADA, 'comment_web', TASK, 'web'),
        draftBy(ADA, 'comment_docs', TASK, 'docs'),
      ],
    });

    expect(review.repository).toBeNull();
    expect(review.comments).toHaveLength(2);
  });

  it('leaves out drafts that another review already contains, so a second submit posts nothing twice', () => {
    const claimed = draftBy(ADA).submittedIn(ReviewId.of('review_0'));

    expect(submit({ body: 'Hi', drafts: [claimed] }).comments).toEqual([]);
    expect(() => submit({ drafts: [claimed] })).toThrow(InvalidReviewError);
  });

  it('is posted once only', () => {
    const posted = submit({ verdict: 'approve' }).postedAs(posting(99));

    expect(() => posted.postedAs(posting(100))).toThrow(InvalidReviewError);
  });

  it('approves with nothing else to say', () => {
    expect(submit({ verdict: 'approve' }).verdict).toBe('approve');
  });

  it('rejects a comment or request for changes that says nothing', () => {
    expect(() => submit({ verdict: 'comment' })).toThrow(InvalidReviewError);
    expect(() => submit({ verdict: 'request-changes' })).toThrow(
      InvalidReviewError,
    );
    expect(submit({ verdict: 'comment', body: 'Looks close' }).body).toBe(
      'Looks close',
    );
  });

  it('leaves out someone else’s drafts, and another task’s', () => {
    expect(
      submit({
        body: 'Hi',
        drafts: [
          draftBy(BOB, 'comment_1'),
          draftBy(ADA, 'comment_2', TaskId.of('task_2')),
          draftBy(ADA, 'comment_3'),
        ],
      }).comments.map((each) => each.value),
    ).toEqual(['comment_3']);
  });

  it('rejects a verdict GitHub has no word for', () => {
    expect(() => submit({ verdict: 'reject', body: 'No' })).toThrow(
      InvalidReviewError,
    );
  });

  it('is posted once GitHub assigns it a number', () => {
    const posted = submit({ verdict: 'approve' }).postedAs(posting(99));

    expect(posted.state).toBe('posted');
    expect(posted.githubId).toBe(99);
    expect(posted.verdictOnGitHub).toBe('approve');
    expect(posted.postedAsComment).toBe(false);
  });

  it('records that GitHub took its verdict as a comment, and takes no other verdict in its place', () => {
    const asComment = submit({
      verdict: 'request-changes',
      body: 'Fix it',
    }).postedAs(posting(99, 'comment'));

    expect(asComment.verdictOnGitHub).toBe('comment');
    expect(asComment.postedAsComment).toBe(true);
    expect(() =>
      submit({ verdict: 'request-changes', body: 'Fix it' }).postedAs(
        posting(99, 'approve'),
      ),
    ).toThrow(InvalidReviewError);
  });

  it('says where GitHub put each comment it posted, one by one', () => {
    const review = submit({ drafts: [draftBy(ADA)] });
    review.pullEvents();
    const github = { id: 101, url: 'https://github.com/c/101' };

    const posted = review.postedAs({
      githubId: 99,
      verdictOnGitHub: 'comment',
      comments: [draftBy(ADA).submittedIn(review.id)],
      onLinesOnGitHub: [github],
      now: NOW,
    });

    expect(posted.pullEvents()).toEqual([
      expect.objectContaining({ kind: 'review.posted', onFiles: [] }),
      expect.objectContaining({
        kind: 'review.included-comment-posted',
        commentId: ReviewCommentId.of('comment_1'),
        github,
      }),
    ]);
  });

  it('plans to post only the comments it contains that are on their way, lines in the review and files on their own', () => {
    const review = submit({ drafts: [draftBy(ADA)] });
    const onLines = draftBy(ADA, 'comment_1').submittedIn(review.id);
    const onFile = ReviewComment.draft({
      id: ReviewCommentId.of('comment_2'),
      workspaceId: WorkspaceId.of('workspace_1'),
      taskId: TASK,
      anchor: ReviewAnchor.onFile('src/a.ts'),
      body: 'About the file',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    }).submittedIn(review.id);
    const elsewhere = draftBy(ADA, 'comment_3').submittedIn(
      ReviewId.of('review_2'),
    );
    const deleted = draftBy(ADA, 'comment_4')
      .submittedIn(review.id)
      .deleted(ADA);

    const plan = review.postingPlan([
      onLines,
      onFile,
      elsewhere,
      deleted,
      null,
    ]);

    expect(plan.onLines.map((each) => each.id.value)).toEqual(['comment_1']);
    expect(plan.onFiles.map((each) => each.id.value)).toEqual(['comment_2']);
    expect(plan.deleted.map((each) => each.id.value)).toEqual(['comment_4']);
    expect(plan.empty).toBe(false);
  });

  it('fails to post once, and returns its comments to draft', () => {
    const review = submit({ drafts: [draftBy(ADA)] });
    review.pullEvents();
    const failed = review.failedToPost(UNREACHABLE);

    expect(failed.state).toBe('failed');
    expect(failed.failure).toEqual(UNREACHABLE);
    expect(failed.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review.included-comment-returned',
        commentId: ReviewCommentId.of('comment_1'),
      }),
    ]);
    expect(failed.failedToPost(UNREACHABLE)).toBe(failed);
    expect(() => failed.postedAs(posting(99))).toThrow(InvalidReviewError);
  });

  it('is discarded only when every comment it contained is gone and it has no other content', () => {
    const review = submit({ drafts: [draftBy(ADA)] });
    const submitted = draftBy(ADA).submittedIn(review.id);
    review.pullEvents();

    expect(review.postingPlan([submitted]).empty).toBe(false);
    expect(() => review.discard([submitted])).toThrow(InvalidReviewError);
    expect(review.postingPlan([]).empty).toBe(true);

    const discarded = review.discard([]);

    expect(discarded.state).toBe('discarded');
    expect(discarded.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review.included-comment-returned',
        commentId: ReviewCommentId.of('comment_1'),
      }),
    ]);
    expect(
      submit({ verdict: 'approve', drafts: [draftBy(ADA)] }).postingPlan([])
        .empty,
    ).toBe(false);
    expect(
      submit({ body: 'Overall fine', drafts: [draftBy(ADA)] }).postingPlan([])
        .empty,
    ).toBe(false);
  });
});
