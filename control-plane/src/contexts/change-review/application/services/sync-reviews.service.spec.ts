import type {
  ReviewOutboxEntry,
  ReviewOutboxPort,
} from '@change-review/application/ports/review-outbox.port';
import {
  MAX_ATTEMPTS,
  MAX_WAITS_FOR_THREAD,
  SyncReviews,
} from '@change-review/application/services/sync-reviews.service';
import { Review } from '@change-review/domain/aggregates/review.aggregate';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { ReviewCommentVersionConflictError } from '@change-review/domain/exceptions/review-comment-version-conflict.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';

import type { PullRequestReviewsPort } from '@github/application/ports/pull-request-reviews.port';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
  ReviewComment.draft({
    id: ReviewCommentId.of(id),
    workspaceId: WORKSPACE,
    taskId: TASK,
    anchor: ReviewAnchor.onLines({ path: 'src/a.ts', side: 'new', line }),
    body: `About line ${line}`,
    author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
    now: NOW,
  });

const syncing = (over: {
  pullRequest?: PullRequestUrl | null;
  sync: Omit<ReviewOutboxEntry, 'id' | 'workspaceId' | 'taskId'>;
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
  const recorded: { how: string; args: unknown[] }[] = [];
  let pending: ReviewOutboxEntry | null = {
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
    done: async (...args) => void recorded.push({ how: 'done', args }),
    later: async (...args) => void recorded.push({ how: 'later', args }),
    failed: async (...args) => void recorded.push({ how: 'failed', args }),
    failuresFor: async () => new Map(),
    deleteTask: async () => undefined,
  };

  const task = {
    id: TASK,
    workspaceId: WORKSPACE,
    teamId: null,
    pullRequest: over.pullRequest === undefined ? PULL : over.pullRequest,
    reviewing: false,
    currentRunId: null,
  };

  const conflicts = new Set<string>();

  const github: PullRequestReviewsPort = {
    submit: vi.fn(async (input) => ({
      githubId: 900,
      comments: input.comments.map((_: unknown, index: number) => ({
        id: 100 + index,
        url: `https://github.com/c/${100 + index}`,
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
    commentOnFile: vi.fn(async () => ({
      id: 777,
      url: 'https://github.com/c/777',
    })),
    edit: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    ...over.github,
  };

  const reports = { report: vi.fn() };
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
          throw new ReviewCommentVersionConflictError(comment.id.value);
        }
        comments.set(comment.id.value, comment);
      },
    } as ReviewCommentRepository,
    {
      run: async () => null,
      wasWorkedBy: async () => false,
      teamOfRun: async () => null,
      reasoning: async () => null,
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
    reports,
  );

  return { service, recorded, github, comments, reviews, reports };
};

const submitted = () => {
  const { review, claimed } = Review.submit({
    id: ReviewId.of('review_1'),
    workspaceId: WORKSPACE,
    taskId: TASK,
    author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
    verdict: 'request-changes',
    body: 'A few things',
    drafts: [draft('comment_1', 3), draft('comment_2', 9)],
    now: NOW,
  });
  return { review, comments: [...claimed] };
};

describe('SyncReviews', () => {
  it('posts a submitted review with its comments, and stores where GitHub put them', async () => {
    const { review, comments } = submitted();
    const synced = syncing({
      sync: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
    });

    await synced.service.syncDue();

    expect(synced.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'request-changes',
        body: 'A few things',
        by: { kind: 'person', userId: ADA, name: 'Ada' },
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
    expect(synced.reviews.get('review_1')?.pullEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'review.posted' }),
        expect.objectContaining({
          kind: 'review.comment-posted',
          github: { id: 100, url: 'https://github.com/c/100' },
        }),
        expect.objectContaining({
          kind: 'review.comment-posted',
          github: { id: 101, url: 'https://github.com/c/101' },
        }),
      ]),
    );
    expect(synced.recorded).toEqual([{ how: 'done', args: ['sync_1'] }]);
  });

  it('posts an agent’s review as Spotlight itself, naming nobody', async () => {
    const agent = ReviewAuthor.agent(RunId.of('run_1'));
    const { review, claimed } = Review.submit({
      id: ReviewId.of('review_1'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      author: agent,
      verdict: 'comment',
      body: 'One thing',
      drafts: [
        ReviewComment.draft({
          id: ReviewCommentId.of('comment_1'),
          workspaceId: WORKSPACE,
          taskId: TASK,
          anchor: ReviewAnchor.onLines({
            path: 'src/a.ts',
            side: 'new',
            line: 3,
          }),
          body: 'About line 3',
          author: agent,
          now: NOW,
        }),
      ],
      now: NOW,
    });
    const synced = syncing({
      sync: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments: [...claimed],
    });

    await synced.service.syncDue();

    expect(synced.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({ by: { kind: 'spotlight' } }),
    );
  });

  it('posts only the comments its own review contains', async () => {
    const { review, comments } = submitted();
    const second = Review.rehydrate({
      id: ReviewId.of('review_2'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
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
    expect(synced.recorded).toEqual([
      {
        how: 'later',
        args: ['sync_1', new Date(NOW.getTime() + 60_000), null, false],
      },
    ]);
  });

  it('retries later where GitHub answers with an error, then gives up', async () => {
    const { review, comments } = submitted();
    const failing = {
      submit: vi.fn(async () => {
        throw new UpstreamError('submit the review', 'Server Error');
      }),
    };

    const early = syncing({
      sync: { kind: 'review', subjectId: 'review_1', attempts: 1 },
      reviews: [review],
      comments,
      github: failing,
    });
    await early.service.syncDue();

    expect(early.reports.report).not.toHaveBeenCalled();
    expect(early.recorded).toEqual([
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
        attempts: MAX_ATTEMPTS - 1,
      },
      reviews: [review],
      comments,
      github: failing,
    });
    await last.service.syncDue();

    expect(last.recorded).toEqual([
      { how: 'failed', args: ['sync_1', 'submit the review: Server Error'] },
    ]);
    expect(last.reviews.get('review_1')?.state).toBe('failed');
    expect(last.reviews.get('review_1')?.pullEvents()).toContainEqual(
      expect.objectContaining({ kind: 'review.comment-not-posted' }),
    );
    expect(last.reports.report).toHaveBeenCalledExactlyOnceWith(
      expect.any(UpstreamError),
      expect.objectContaining({ source: 'Syncing reviews with GitHub' }),
    );
  });

  it('discards a review whose every comment was deleted on its way, without calling GitHub', async () => {
    const { review, comments } = submitted();
    const synced = syncing({
      sync: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [
        Review.submit({
          id: review.id,
          workspaceId: WORKSPACE,
          taskId: TASK,
          author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
          verdict: 'comment',
          body: '',
          drafts: [draft('comment_1', 3), draft('comment_2', 9)],
          now: NOW,
        }).review,
      ],
      comments: comments.map((each) => each.deleted(ADA)),
    });

    await synced.service.syncDue();

    expect(synced.github.submit).not.toHaveBeenCalled();
    expect(synced.reviews.get('review_1')?.state).toBe('discarded');
    expect(synced.reviews.get('review_1')?.pullEvents()).toContainEqual(
      expect.objectContaining({ kind: 'review.comment-not-posted' }),
    );
    expect(synced.recorded).toEqual([{ how: 'done', args: ['sync_1'] }]);
  });

  it('fails a reply to a comment whose review was never posted to GitHub', async () => {
    const sending = draft('comment_1', 3).submittedIn(ReviewId.of('review_1'));
    const reply = sending.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });
    const synced = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [sending.notPosted(), reply],
    });

    await synced.service.syncDue();

    expect(synced.github.reply).not.toHaveBeenCalled();
    expect(synced.recorded[0]?.how).toBe('failed');
    expect(synced.comments.get('comment_2')?.state).toBe('failed');
  });

  it('stops waiting for the comment a reply answers after a while', async () => {
    const sending = draft('comment_1', 3).submittedIn(ReviewId.of('review_1'));
    const reply = sending.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });

    const waiting = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [sending, reply],
    });
    await waiting.service.syncDue();

    expect(waiting.recorded).toEqual([
      {
        how: 'later',
        args: ['sync_1', new Date(NOW.getTime() + 60_000), null, true],
      },
    ]);

    const tired = syncing({
      sync: {
        kind: 'reply',
        subjectId: 'comment_2',
        attempts: MAX_WAITS_FOR_THREAD - 1,
      },
      comments: [sending, reply],
    });
    await tired.service.syncDue();

    expect(tired.recorded[0]?.how).toBe('failed');
    expect(tired.comments.get('comment_2')?.state).toBe('failed');
  });

  it('posts a review with its comments on lines, and sends each comment on a whole file in a post of its own', async () => {
    const onFile = ReviewComment.draft({
      id: ReviewCommentId.of('comment_3'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      anchor: ReviewAnchor.onFile('src/a.ts'),
      body: 'About the file',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });
    const { review, claimed } = Review.submit({
      id: ReviewId.of('review_1'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      verdict: 'comment',
      body: '',
      drafts: [draft('comment_1', 3), onFile],
      now: NOW,
    });
    const synced = syncing({
      sync: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments: [...claimed],
    });

    await synced.service.syncDue();

    expect(synced.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: [expect.objectContaining({ line: 3 })],
      }),
    );
    expect(synced.github.commentOnFile).not.toHaveBeenCalled();
    expect(synced.reviews.get('review_1')?.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'review.posted',
        onFiles: [ReviewCommentId.of('comment_3')],
      }),
    );
  });

  it('posts a comment on a whole file on its own, and stores where GitHub put it', async () => {
    const onFile = ReviewComment.draft({
      id: ReviewCommentId.of('comment_3'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      anchor: ReviewAnchor.onFile('src/a.ts'),
      body: 'About the file',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    }).submittedIn(ReviewId.of('review_1'));
    const synced = syncing({
      sync: { kind: 'file', subjectId: 'comment_3', attempts: 0 },
      comments: [onFile],
    });

    await synced.service.syncDue();

    expect(synced.github.commentOnFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'src/a.ts', body: 'About the file' }),
    );
    expect(synced.comments.get('comment_3')?.state).toBe('posted');
    expect(synced.comments.get('comment_3')?.github?.id).toBe(777);

    await synced.service.syncDue();

    expect(synced.github.commentOnFile).toHaveBeenCalledTimes(1);
  });

  it('replies in the thread once the comment it answers is on GitHub', async () => {
    const parent = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' });
    const reply = parent.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
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

  it('stores where GitHub put a reply edited while it was posted, and never posts it twice', async () => {
    const parent = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' });
    const reply = parent.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });
    reply.pullEvents();
    const synced = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [parent, reply],
      editedWhilePosting: (comment) =>
        comment.edited('Done, and tested', ADA, NOW),
    });

    await synced.service.syncDue();

    const stored = synced.comments.get('comment_2');
    expect(synced.github.reply).toHaveBeenCalledTimes(1);
    expect(stored?.github?.id).toBe(555);
    expect(stored?.body).toBe('Done, and tested');
    expect(stored?.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'review-comment.edited',
        onGitHub: true,
      }),
    );
    expect(synced.recorded).toEqual([{ how: 'done', args: ['sync_1'] }]);

    const again = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 1 },
      comments: [parent, stored as ReviewComment],
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
      comments: [first.edited('Clearer', ADA, NOW), second.deleted(ADA)],
    });

    await synced.service.syncDue();

    expect(synced.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: [expect.objectContaining({ line: 3, body: 'About line 3' })],
      }),
    );
    expect(synced.reviews.get('review_1')?.pullEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'review.comment-posted',
          github: { id: 100, url: 'https://github.com/c/100' },
        }),
        expect.objectContaining({
          kind: 'review.comment-posted',
          commentId: second.id,
          github: null,
        }),
      ]),
    );
  });

  it('does not send a reply while the comment it answers is still on its way', async () => {
    const parent = draft('comment_1', 3).submittedIn(ReviewId.of('review_1'));
    const reply = parent.postedAs(null).replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });
    const synced = syncing({
      sync: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [parent, reply],
    });

    await synced.service.syncDue();

    expect(synced.github.reply).not.toHaveBeenCalled();
    expect(synced.recorded[0]?.how).toBe('later');
  });

  it('carries an edit and a deletion to the comment on GitHub', async () => {
    const posted = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' })
      .edited('Clearer', ADA, NOW);

    const edited = syncing({
      sync: { kind: 'edit', subjectId: 'comment_1', attempts: 0 },
      comments: [posted],
    });
    await edited.service.syncDue();

    expect(edited.github.edit).toHaveBeenCalledWith(
      expect.objectContaining({ commentId: 77, body: 'Clearer' }),
    );

    const deleted = syncing({
      sync: { kind: 'delete', subjectId: 'comment_1', attempts: 0 },
      comments: [posted.deleted(ADA)],
    });
    await deleted.service.syncDue();

    expect(deleted.github.remove).toHaveBeenCalledWith(
      expect.objectContaining({ commentId: 77 }),
    );
  });

  it('remembers the edit it sent, and still has to send one made while sending it', async () => {
    const posted = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' })
      .edited('First', ADA, NOW);
    let synced: ReturnType<typeof syncing> | null = null;

    synced = syncing({
      sync: { kind: 'edit', subjectId: 'comment_1', attempts: 0 },
      comments: [posted],
      github: {
        edit: vi.fn(async () => {
          synced?.comments.set('comment_1', posted.edited('Second', ADA, NOW));
        }),
      },
    });
    await synced.service.syncDue();

    const stored = synced.comments.get('comment_1');
    expect(stored?.body).toBe('Second');
    expect(stored?.editPending).toBe(true);
    expect(stored?.pendingOwnEdits).toEqual(['First']);
  });

  it('drops a pending edit GitHub would never take', async () => {
    const pending = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' })
      .edited('Clearer', ADA, NOW);
    const synced = syncing({
      sync: { kind: 'edit', subjectId: 'comment_1', attempts: MAX_ATTEMPTS },
      comments: [pending],
      github: {
        edit: vi.fn(async () => {
          throw new UpstreamError('edit the review comment', '422');
        }),
      },
    });

    await synced.service.syncDue();

    expect(synced.recorded[0]?.how).toBe('failed');
    expect(synced.comments.get('comment_1')?.editPending).toBe(false);
  });
});
