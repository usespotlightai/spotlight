import type {
  ReviewOutboxPort,
  ReviewSync,
} from '@change-review/application/ports/review-outbox.port';
import {
  MOST_ATTEMPTS,
  MOST_WAITS_FOR_THREAD,
  SyncReviews,
} from '@change-review/application/services/sync-reviews.service';
import { Review } from '@change-review/domain/aggregates/review.aggregate';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { ChangedSinceReadError } from '@change-review/domain/exceptions/changed-since-read.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import type { PullRequestReviewsPort } from '@github/application/ports/pull-request-reviews.port';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-16T10:00:00Z');
const ADA = UserId.of('user_ada');
const WORKSPACE = WorkspaceId.of('workspace_1');
const TASK = TaskId.of('task_1');
const PULL = PullRequestUrl.of('https://github.com/acme/web/pull/7');

const draft = (id: string, line: number) =>
  ReviewComment.drafted({
    id: ReviewCommentId.of(id),
    workspaceId: WORKSPACE,
    taskId: TASK,
    anchor: ReviewAnchor.of({ path: 'src/a.ts', side: 'new', line }),
    body: `About line ${line}`,
    author: { userId: ADA, login: null, name: AuthorName.of('Ada') },
    now: NOW,
  });

const syncing = (over: {
  pullRequest?: PullRequestUrl | null;
  sync: Omit<ReviewSync, 'id' | 'workspaceId' | 'taskId'>;
  comments?: ReviewComment[];
  reviews?: Review[];
  github?: Partial<PullRequestReviewsPort>;
  editedWhilePosting?: (comment: ReviewComment) => ReviewComment;
}) => {
  const comments = new Map(
    (over.comments ?? []).map((each) => [each.id.value, each]),
  );
  const reviews = new Map(
    (over.reviews ?? []).map((each) => [each.id.value, each]),
  );
  const settled: { how: string; args: unknown[] }[] = [];
  let pending: ReviewSync | null = {
    id: 'sync_1',
    workspaceId: WORKSPACE,
    taskId: TASK,
    ...over.sync,
  };

  const outbox: ReviewOutboxPort = {
    enqueue: vi.fn(),
    claimDue: async () => {
      const next = pending;
      pending = null;
      return next;
    },
    done: async (...args) => void settled.push({ how: 'done', args }),
    later: async (...args) => void settled.push({ how: 'later', args }),
    failed: async (...args) => void settled.push({ how: 'failed', args }),
    failuresFor: async () => new Map(),
    forgetTask: async () => undefined,
  };

  const task = {
    id: TASK,
    workspaceId: WORKSPACE,
    teamId: null,
    pullRequest: over.pullRequest === undefined ? PULL : over.pullRequest,
  };

  const conflicts = new Set<string>();

  const github: PullRequestReviewsPort = {
    submit: vi.fn(async (input) => ({
      githubId: 900,
      comments: input.comments.map((_: unknown, place: number) => ({
        id: 100 + place,
        url: `https://github.com/c/${100 + place}`,
      })),
    })),
    reply: vi.fn(async (input) => {
      const { editedWhilePosting } = over;

      if (editedWhilePosting) {
        for (const each of comments.values()) {
          if (each.sending && each.body === input.body) {
            comments.set(each.id.value, editedWhilePosting(each));
            conflicts.add(each.id.value);
          }
        }
      }
      return { id: 555, url: 'https://github.com/c/555' };
    }),
    edit: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    ...over.github,
  };

  const service = new SyncReviews(
    outbox,
    {
      find: async (id) => reviews.get(id.value) ?? null,
      save: async (review) => void reviews.set(review.id.value, review),
    } as ReviewRepository,
    {
      find: async (id) => comments.get(id.value) ?? null,
      save: async (comment) => {
        if (conflicts.delete(comment.id.value)) {
          throw new ChangedSinceReadError('review comment', comment.id.value);
        }
        comments.set(comment.id.value, comment);
      },
    } as ReviewCommentRepository,
    {
      run: async () => null,
      wasWorkedBy: async () => false,
      task: async () => task,
      taskWithPullRequest: async () => null,
    },
    {
      isConnected: async () => true,
    },
    {
      find: async () => ({ name: 'Ada', image: null }),
      pictureOf: () => null,
      memberOf: async () => null,
    },
    github,
    { now: () => NOW, sleep: async () => {} },
    { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  );

  return { service, settled, github, comments, reviews };
};

const submitted = () => {
  const { review, claimed } = Review.submit({
    id: ReviewId.of('review_1'),
    workspaceId: WORKSPACE,
    taskId: TASK,
    author: ADA,
    verdict: 'request-changes',
    body: 'A few things',
    drafts: [draft('comment_1', 3), draft('comment_2', 9)],
    now: NOW,
  });
  return { review, comments: [...claimed] };
};

describe('SyncReviews', () => {
  it('posts a submitted review with its comments, and keeps where GitHub put them', async () => {
    const { review, comments } = submitted();
    const synced = syncing({
      sync: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
    });

    await synced.service.syncDue();

    expect(synced.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: 'request-changes',
        body: 'A few things',
        by: { userId: ADA, name: 'Ada' },
        comments: [
          {
            path: 'src/a.ts',
            side: 'new',
            line: 3,
            startLine: null,
            body: 'About line 3',
          },
          {
            path: 'src/a.ts',
            side: 'new',
            line: 9,
            startLine: null,
            body: 'About line 9',
          },
        ],
      }),
    );
    expect(synced.reviews.get('review_1')?.state).toBe('posted');
    expect(synced.reviews.get('review_1')?.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'review.posted',
        placed: [
          expect.objectContaining({
            github: { id: 100, url: 'https://github.com/c/100' },
          }),
          expect.objectContaining({
            github: { id: 101, url: 'https://github.com/c/101' },
          }),
        ],
      }),
    );
    expect(synced.settled).toEqual([{ how: 'done', args: ['sync_1'] }]);
  });

  it('posts only the comments its own review holds', async () => {
    const { review, comments } = submitted();
    const second = Review.rehydrate({
      id: ReviewId.of('review_2'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      author: ADA,
      verdict: 'comment',
      body: 'Again',
      comments: review.comments,
      state: 'submitted',
      githubId: null,
      submittedAt: NOW,
      postedAt: null,
      version: 0,
    });
    const synced = syncing({
      sync: { kind: 'review', subjectId: 'review_2', attempts: 0 },
      reviews: [review, second],
      comments,
    });

    await synced.service.syncDue();

    expect(synced.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Again', comments: [] }),
    );
  });

  it('waits, without counting it a failure, until the task has a pull request', async () => {
    const { review, comments } = submitted();
    const synced = syncing({
      pullRequest: null,
      sync: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
    });

    await synced.service.syncDue();

    expect(synced.github.submit).not.toHaveBeenCalled();
    expect(synced.settled).toEqual([
      {
        how: 'later',
        args: ['sync_1', new Date(NOW.getTime() + 60_000), null, false],
      },
    ]);
  });

  it('tries again later where GitHub refuses, then gives up', async () => {
    const { review, comments } = submitted();
    const refusing = {
      submit: vi.fn(async () => {
        throw new UpstreamRefusedError('submit the review', 'Server Error');
      }),
    };

    const early = syncing({
      sync: { kind: 'review', subjectId: 'review_1', attempts: 1 },
      reviews: [review],
      comments,
      github: refusing,
    });
    await early.service.syncDue();

    expect(early.settled).toEqual([
      {
        how: 'later',
        args: [
          'sync_1',
          new Date(NOW.getTime() + 60_000),
          'submit the review: Server Error',
          true,
        ],
      },
    ]);

    const last = syncing({
      sync: {
        kind: 'review',
        subjectId: 'review_1',
        attempts: MOST_ATTEMPTS - 1,
      },
      reviews: [review],
      comments,
      github: refusing,
    });
    await last.service.syncDue();

    expect(last.settled).toEqual([
      { how: 'failed', args: ['sync_1', 'submit the review: Server Error'] },
    ]);
    expect(last.reviews.get('review_1')?.state).toBe('failed');
    expect(last.reviews.get('review_1')?.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'review.not-posted',
        outcome: 'failed',
      }),
    );
  });

  it('withdraws a review whose every comment was deleted on its way, without asking GitHub', async () => {
    const { review, comments } = submitted();
    const synced = syncing({
      sync: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [
        Review.submit({
          id: review.id,
          workspaceId: WORKSPACE,
          taskId: TASK,
          author: ADA,
          verdict: 'comment',
          body: '',
          drafts: [draft('comment_1', 3), draft('comment_2', 9)],
          now: NOW,
        }).review,
      ],
      comments: comments.map((each) => each.removed(ADA)),
    });

    await synced.service.syncDue();

    expect(synced.github.submit).not.toHaveBeenCalled();
    expect(synced.reviews.get('review_1')?.state).toBe('withdrawn');
    expect(synced.reviews.get('review_1')?.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'review.not-posted',
        outcome: 'withdrawn',
      }),
    );
    expect(synced.settled).toEqual([{ how: 'done', args: ['sync_1'] }]);
  });

  it('fails a reply to a comment whose review never reached GitHub', async () => {
    const sending = draft('comment_1', 3).submittedIn(ReviewId.of('review_1'));
    const reply = sending.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: { userId: ADA, login: null, name: AuthorName.of('Ada') },
      now: NOW,
    });
    const synced = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [sending.notPosted(), reply],
    });

    await synced.service.syncDue();

    expect(synced.github.reply).not.toHaveBeenCalled();
    expect(synced.settled[0]?.how).toBe('failed');
    expect(synced.comments.get('comment_2')?.state).toBe('failed');
  });

  it('stops waiting for the comment a reply answers after a while', async () => {
    const sending = draft('comment_1', 3).submittedIn(ReviewId.of('review_1'));
    const reply = sending.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: { userId: ADA, login: null, name: AuthorName.of('Ada') },
      now: NOW,
    });

    const waiting = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [sending, reply],
    });
    await waiting.service.syncDue();

    expect(waiting.settled).toEqual([
      {
        how: 'later',
        args: ['sync_1', new Date(NOW.getTime() + 60_000), null, true],
      },
    ]);

    const tired = syncing({
      sync: {
        kind: 'reply',
        subjectId: 'comment_2',
        attempts: MOST_WAITS_FOR_THREAD - 1,
      },
      comments: [sending, reply],
    });
    await tired.service.syncDue();

    expect(tired.settled[0]?.how).toBe('failed');
    expect(tired.comments.get('comment_2')?.state).toBe('failed');
  });

  it('replies in the thread once the comment it answers is on GitHub', async () => {
    const parent = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' });
    const reply = parent.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: { userId: ADA, login: null, name: AuthorName.of('Ada') },
      now: NOW,
    });
    const synced = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [parent, reply],
    });

    await synced.service.syncDue();

    expect(synced.github.reply).toHaveBeenCalledWith(
      expect.objectContaining({ to: 77, body: 'Done' }),
    );
    expect(synced.comments.get('comment_2')?.github?.id).toBe(555);
  });

  it('keeps where GitHub put a reply edited while it was posted, and never posts it twice', async () => {
    const parent = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' });
    const reply = parent.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: { userId: ADA, login: null, name: AuthorName.of('Ada') },
      now: NOW,
    });
    reply.pullEvents();
    const synced = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [parent, reply],
      editedWhilePosting: (comment) =>
        comment.rewritten('Done, and tested', ADA, NOW),
    });

    await synced.service.syncDue();

    const kept = synced.comments.get('comment_2');
    expect(synced.github.reply).toHaveBeenCalledTimes(1);
    expect(kept?.github?.id).toBe(555);
    expect(kept?.body).toBe('Done, and tested');
    expect(kept?.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'review-comment.rewritten',
        onGitHub: true,
      }),
    );
    expect(synced.settled).toEqual([{ how: 'done', args: ['sync_1'] }]);

    const again = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 1 },
      comments: [parent, kept as ReviewComment],
    });
    await again.service.syncDue();

    expect(again.github.reply).not.toHaveBeenCalled();
  });

  it('posts a comment as it was submitted, and leaves out one deleted before it was sent', async () => {
    const { review, comments } = submitted();
    const [first, second] = comments as [ReviewComment, ReviewComment];
    const synced = syncing({
      sync: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments: [first.rewritten('Clearer', ADA, NOW), second.removed(ADA)],
    });

    await synced.service.syncDue();

    expect(synced.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: [expect.objectContaining({ line: 3, body: 'About line 3' })],
      }),
    );
    expect(synced.reviews.get('review_1')?.pullEvents()).toContainEqual(
      expect.objectContaining({
        placed: [
          expect.objectContaining({
            github: { id: 100, url: 'https://github.com/c/100' },
          }),
          { commentId: second.id, github: null },
        ],
      }),
    );
  });

  it('holds a reply back while the comment it answers is still on its way', async () => {
    const parent = draft('comment_1', 3).submittedIn(ReviewId.of('review_1'));
    const reply = parent.postedAs(null).replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: { userId: ADA, login: null, name: AuthorName.of('Ada') },
      now: NOW,
    });
    const synced = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [parent, reply],
    });

    await synced.service.syncDue();

    expect(synced.github.reply).not.toHaveBeenCalled();
    expect(synced.settled[0]?.how).toBe('later');
  });

  it('carries an edit and a deletion to the comment on GitHub', async () => {
    const posted = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' })
      .rewritten('Clearer', ADA, NOW);

    const edited = syncing({
      sync: { kind: 'edit', subjectId: 'comment_1', attempts: 0 },
      comments: [posted],
    });
    await edited.service.syncDue();

    expect(edited.github.edit).toHaveBeenCalledWith(
      expect.objectContaining({ commentId: 77, body: 'Clearer' }),
    );

    const removed = syncing({
      sync: { kind: 'delete', subjectId: 'comment_1', attempts: 0 },
      comments: [posted.removed(ADA)],
    });
    await removed.service.syncDue();

    expect(removed.github.remove).toHaveBeenCalledWith(
      expect.objectContaining({ commentId: 77 }),
    );
  });

  it('remembers the edit it sent, and still owes one made while sending it', async () => {
    const posted = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' })
      .rewritten('First', ADA, NOW);
    let synced: ReturnType<typeof syncing> | null = null;

    synced = syncing({
      sync: { kind: 'edit', subjectId: 'comment_1', attempts: 0 },
      comments: [posted],
      github: {
        edit: vi.fn(async () => {
          synced?.comments.set(
            'comment_1',
            posted.rewritten('Second', ADA, NOW),
          );
        }),
      },
    });
    await synced.service.syncDue();

    const kept = synced.comments.get('comment_1');
    expect(kept?.body).toBe('Second');
    expect(kept?.editPending).toBe(true);
    expect(kept?.editsAwaitingEcho).toEqual(['First']);
  });

  it('stops owing an edit GitHub would never take', async () => {
    const owed = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' })
      .rewritten('Clearer', ADA, NOW);
    const synced = syncing({
      sync: { kind: 'edit', subjectId: 'comment_1', attempts: MOST_ATTEMPTS },
      comments: [owed],
      github: {
        edit: vi.fn(async () => {
          throw new UpstreamRefusedError('edit the review comment', '422');
        }),
      },
    });

    await synced.service.syncDue();

    expect(synced.settled[0]?.how).toBe('failed');
    expect(synced.comments.get('comment_1')?.editPending).toBe(false);
  });
});
