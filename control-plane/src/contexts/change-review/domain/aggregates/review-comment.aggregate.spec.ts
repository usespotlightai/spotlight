import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { InvalidFilePathError } from '@change-review/domain/exceptions/invalid-file-path.error';
import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import { NotYourReviewCommentError } from '@change-review/domain/exceptions/not-your-review-comment.error';
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

const ANCHOR = ReviewAnchor.onLines({
  path: 'src/invite.ts',
  side: 'new',
  line: 12,
});

const drafted = (body = 'Should this expire?') =>
  ReviewComment.drafted({
    id: ReviewCommentId.of('comment_1'),
    workspaceId: WorkspaceId.of('workspace_1'),
    taskId: TaskId.of('task_1'),
    anchor: ANCHOR,
    body,
    author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
    now: NOW,
  });

describe('ReviewAnchor', () => {
  it('refuses a line that is not a line, on a file with no path', () => {
    expect(() =>
      ReviewAnchor.onLines({ path: 'a.ts', side: 'new', line: 0 }),
    ).toThrow(InvalidReviewError);
    expect(() =>
      ReviewAnchor.onLines({ path: 'a.ts', side: 'middle', line: 3 }),
    ).toThrow(InvalidReviewError);
    expect(() =>
      ReviewAnchor.onLines({ path: ' ', side: 'old', line: 3 }),
    ).toThrow(InvalidFilePathError);
  });
});

describe('ReviewComment', () => {
  it('starts as a draft only its author sees', () => {
    const comment = drafted('  Should this expire?  ');

    expect(comment.state).toBe('draft');
    expect(comment.body).toBe('Should this expire?');
    expect(comment.visibleTo(ADA)).toBe(true);
    expect(comment.visibleTo(BOB)).toBe(false);
  });

  it('refuses a comment that says nothing', () => {
    expect(() => drafted('   ')).toThrow(InvalidReviewError);
  });

  it('shows to everyone once submitted, and joins GitHub once posted', () => {
    const submitted = drafted().submittedIn(ReviewId.of('review_1'));

    expect(submitted.state).toBe('submitted');
    expect(submitted.reviewId?.value).toBe('review_1');
    expect(submitted.visibleTo(BOB)).toBe(true);

    const posted = submitted.postedAs({
      id: 42,
      url: 'https://github.com/c/42',
    });

    expect(posted.state).toBe('posted');
    expect(posted.github?.id).toBe(42);
  });

  it('replies on the same line, to the first comment of the thread', () => {
    const posted = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 42, url: 'https://github.com/c/42' });

    const reply = posted.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Yes, after a week',
      author: ReviewAuthor.person(BOB, AuthorName.of('Bob')),
      now: NOW,
    });

    expect(reply.state).toBe('submitted');
    expect(reply.replyTo?.value).toBe('comment_1');
    expect(reply.anchor.equals(ANCHOR)).toBe(true);

    const second = reply.replied({
      id: ReviewCommentId.of('comment_3'),
      body: 'Good',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });

    expect(second.replyTo?.value).toBe('comment_1');
  });

  it('belongs to the one review that submitted it', () => {
    const submitted = drafted().submittedIn(ReviewId.of('review_1'));

    expect(submitted.heldBy(ReviewId.of('review_1'))).toBe(true);
    expect(submitted.heldBy(ReviewId.of('review_2'))).toBe(false);
    expect(() => submitted.submittedIn(ReviewId.of('review_2'))).toThrow(
      InvalidReviewError,
    );
  });

  it('says what must reach GitHub when it is replied to, rewritten or removed', () => {
    const posted = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 42, url: 'https://github.com/c/42' });
    posted.pullEvents();

    const reply = posted.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Yes',
      author: ReviewAuthor.person(BOB, AuthorName.of('Bob')),
      now: NOW,
    });
    const rewritten = posted.rewritten('Better', ADA, NOW);
    const removed = rewritten.removed(ADA);

    expect(reply.pullEvents()).toEqual([
      expect.objectContaining({ kind: 'review-comment.replied' }),
    ]);
    expect(removed.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review-comment.rewritten',
        onGitHub: true,
      }),
      expect.objectContaining({
        kind: 'review-comment.removed',
        onGitHub: true,
      }),
    ]);
    expect(drafted().removed(ADA).pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review-comment.removed',
        onGitHub: false,
      }),
    ]);
  });

  it('carries an edit made on its way to GitHub once it is posted', () => {
    const sending = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .rewritten('Should this expire after a week?', ADA, NOW);

    expect(sending.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review-comment.rewritten',
        onGitHub: false,
      }),
    ]);
    expect(sending.sending).toBe(true);
    expect(sending.sentBody).toBe('Should this expire?');

    const posted = sending.postedAs({ id: 42, url: 'https://github.com/c/42' });

    expect(posted.state).toBe('posted');
    expect(posted.sending).toBe(false);
    expect(posted.github?.id).toBe(42);
    expect(posted.body).toBe('Should this expire after a week?');
    expect(posted.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review-comment.rewritten',
        onGitHub: true,
      }),
    ]);
  });

  it('keeps where GitHub put a comment deleted on its way, and removes it there', () => {
    const deleted = drafted().submittedIn(ReviewId.of('review_1')).removed(ADA);

    expect(deleted.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review-comment.removed',
        onGitHub: false,
      }),
    ]);

    const posted = deleted.postedAs({ id: 42, url: 'https://github.com/c/42' });

    expect(posted.state).toBe('deleted');
    expect(posted.github?.id).toBe(42);
    expect(posted.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'review-comment.removed',
        onGitHub: true,
      }),
    ]);
  });

  it('owes GitHub nothing where a comment on its way never got there', () => {
    const withdrawn = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .removed(ADA)
      .postedAs(null);
    withdrawn.pullEvents();

    expect(withdrawn.sending).toBe(false);
    expect(withdrawn.pullEvents()).toEqual([]);
  });

  it('is posted only once', () => {
    const posted = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 42, url: 'https://github.com/c/42' });

    expect(posted.postedAs({ id: 43, url: 'https://github.com/c/43' })).toBe(
      posted,
    );
  });

  it('recognises its echo even where it was edited on its way', () => {
    const edited = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .rewritten('Something else entirely', ADA, NOW);

    expect(
      edited.echoes(ANCHOR, '**Ada** via Spotlight:\n\nShould this expire?'),
    ).toBe(true);
  });

  it('recognises its own echo coming back from GitHub', () => {
    const submitted = drafted().submittedIn(ReviewId.of('review_1'));

    expect(
      submitted.echoes(ANCHOR, `**Ada** via Spotlight:\n\n${submitted.body}`),
    ).toBe(true);
    expect(submitted.echoes(ANCHOR, 'Something else')).toBe(false);
    expect(drafted().echoes(ANCHOR, drafted().body)).toBe(false);
  });

  it('refuses a reply to a draft', () => {
    expect(() =>
      drafted().replied({
        id: ReviewCommentId.of('comment_2'),
        body: 'Hm',
        author: ReviewAuthor.person(BOB, AuthorName.of('Bob')),
        now: NOW,
      }),
    ).toThrow(InvalidReviewError);
  });

  it('lets only its author rewrite or remove it', () => {
    const comment = drafted();

    expect(comment.rewritten('Better', ADA, NOW).body).toBe('Better');
    expect(() => comment.rewritten('Mine now', BOB, NOW)).toThrow(
      NotYourReviewCommentError,
    );
    expect(comment.removed(ADA).state).toBe('deleted');
    expect(() => comment.removed(BOB)).toThrow(NotYourReviewCommentError);
  });

  it('follows edits and deletions made on GitHub', () => {
    const posted = ReviewComment.arrived({
      id: ReviewCommentId.of('comment_9'),
      workspaceId: WorkspaceId.of('workspace_1'),
      taskId: TaskId.of('task_1'),
      anchor: ANCHOR,
      body: 'From GitHub',
      author: ReviewAuthor.onGitHub('octocat'),
      replyTo: null,
      github: { id: 7, url: 'https://github.com/c/7' },
      at: NOW,
    });

    expect(posted.visibleTo(ADA)).toBe(true);
    expect(posted.editedOnGitHub('Changed', NOW).body).toBe('Changed');
    expect(posted.deletedOnGitHub().visibleTo(ADA)).toBe(false);
  });

  it('owes GitHub an edit until one carrying its latest words is sent', () => {
    const posted = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 42, url: 'https://github.com/c/42' });

    expect(posted.editPending).toBe(false);

    const first = posted.rewritten('First', ADA, NOW);
    const second = first.rewritten('Second', ADA, NOW);

    expect(first.editPending).toBe(true);
    expect(second.editSent('First').editPending).toBe(true);
    expect(second.editSent('First').editSent('Second').editPending).toBe(false);
    expect(drafted().rewritten('Better', ADA, NOW).editPending).toBe(false);
  });

  it('never lets the echo of its own edit undo a newer one', () => {
    const posted = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 42, url: 'https://github.com/c/42' });
    const later = new Date('2026-09-16T11:00:00Z');

    const sentFirst = posted
      .rewritten('First', ADA, NOW)
      .editSent('First')
      .rewritten('Second', ADA, NOW);
    const echoed = sentFirst.editedOnGitHub('First', later);

    expect(echoed.body).toBe('Second');
    expect(echoed.editPending).toBe(true);

    const outOfOrder = sentFirst
      .editSent('Second')
      .editedOnGitHub('Second', later)
      .editedOnGitHub('First', later);

    expect(outOfOrder.body).toBe('Second');

    const lateEcho = echoed.editSent('Second').editedOnGitHub('Second', later);

    expect(lateEcho.body).toBe('Second');
    expect(lateEcho.editsAwaitingEcho).toEqual([]);
    expect(lateEcho.editedOnGitHub('Someone else’s', later).body).toBe(
      'Someone else’s',
    );
  });

  it('ignores an edit made on GitHub while its own is still owed', () => {
    const owed = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 42, url: 'https://github.com/c/42' })
      .rewritten('Mine', ADA, NOW);

    expect(owed.editedOnGitHub('Theirs', NOW).body).toBe('Mine');
    expect(owed.editNotSent().editedOnGitHub('Theirs', NOW).body).toBe(
      'Theirs',
    );
  });

  it('goes back to draft where the review holding it never reached GitHub', () => {
    const returned = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .rewritten('Clearer', ADA, NOW)
      .notPosted();

    expect(returned.state).toBe('draft');
    expect(returned.reviewId).toBeNull();
    expect(returned.sending).toBe(false);
    expect(returned.body).toBe('Clearer');
    expect(returned.submittedIn(ReviewId.of('review_2')).state).toBe(
      'submitted',
    );

    const withdrawn = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .removed(ADA)
      .notPosted();

    expect(withdrawn.state).toBe('deleted');
    expect(withdrawn.sending).toBe(false);
  });

  it('refuses a reply to a comment that never reached GitHub', () => {
    const failed = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 42, url: 'https://github.com/c/42' })
      .replied({
        id: ReviewCommentId.of('comment_2'),
        body: 'Yes',
        author: ReviewAuthor.person(BOB, AuthorName.of('Bob')),
        now: NOW,
      })
      .notPosted();

    expect(failed.answerable).toBe(false);
    expect(() =>
      failed.replied({
        id: ReviewCommentId.of('comment_3'),
        body: 'Still?',
        author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
        now: NOW,
      }),
    ).toThrow(InvalidReviewError);
  });

  it('is a thread on GitHub only once posted there', () => {
    const submitted = drafted().submittedIn(ReviewId.of('review_1'));
    const posted = submitted.postedAs({
      id: 42,
      url: 'https://github.com/c/42',
    });

    expect(drafted().threadOnGitHub).toBeNull();
    expect(submitted.threadOnGitHub).toBeNull();
    expect(posted.threadOnGitHub?.id).toBe(42);
    expect(posted.removed(ADA).threadOnGitHub).toBeNull();
  });

  it('fails a reply that never reached GitHub', () => {
    const reply = drafted()
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 42, url: 'https://github.com/c/42' })
      .replied({
        id: ReviewCommentId.of('comment_2'),
        body: 'Yes',
        author: ReviewAuthor.person(BOB, AuthorName.of('Bob')),
        now: NOW,
      })
      .notPosted();

    expect(reply.state).toBe('failed');
    expect(reply.sending).toBe(false);
    expect(reply.visibleTo(ADA)).toBe(true);
  });
});

describe('ReviewAnchor across lines', () => {
  it('keeps where a comment on several lines starts', () => {
    const anchor = ReviewAnchor.onLines({
      path: 'src/a.ts',
      side: 'new',
      line: 9,
      startLine: 4,
    });

    expect(anchor.lines?.startLine).toBe(4);
  });

  it('treats a range of one line as that line', () => {
    const anchor = ReviewAnchor.onLines({
      path: 'src/a.ts',
      side: 'new',
      line: 9,
      startLine: 9,
    });

    expect(anchor.lines?.startLine).toBeNull();
  });

  it('is on the whole file, with no lines or side', () => {
    const anchor = ReviewAnchor.onFile('/src/a.ts');

    expect(anchor.path.value).toBe('src/a.ts');
    expect(anchor.wholeFile).toBe(true);
    expect(anchor.lines).toBeNull();
    expect(anchor.equals(ReviewAnchor.onFile('src/a.ts'))).toBe(true);
  });

  it('refuses a range that starts after it ends', () => {
    expect(() =>
      ReviewAnchor.onLines({
        path: 'src/a.ts',
        side: 'old',
        line: 4,
        startLine: 9,
      }),
    ).toThrow(InvalidReviewError);
  });
});
