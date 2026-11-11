import { ReviewPostingFailedError } from '@change-review/application/errors/review-posting-failed.error';
import type {
  LeasedReviewDelivery,
  ReviewDeliveriesPort,
  ReviewDeliveryKind,
} from '@change-review/application/ports/review-deliveries.port';
import type { ReviewPostingPort } from '@change-review/application/ports/review-posting.port';
import { DeliverReviews } from '@change-review/application/services/deliver-reviews.service';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { Review } from '@change-review/domain/aggregates/review.aggregate';
import { ReviewCommentVersionConflictError } from '@change-review/domain/exceptions/review-comment-version-conflict.error';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewDeliveryId } from '@change-review/domain/value-objects/review-delivery-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
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

const MAX_ATTEMPTS = 6;

const MAX_WAITS_FOR_THREAD = 30;

const delivering = (over: {
  pullRequest?: PullRequestUrl | null;
  pullRequests?: readonly PullRequestUrl[];
  delivery: {
    readonly kind: ReviewDeliveryKind;
    readonly subjectId: string;
    readonly attempts: number;
    readonly sendingSince?: Date | null;
  };
  reviewSaveFails?: boolean;
  leaseLost?: boolean;
  comments?: ReviewComment[];
  reviews?: Review[];
  github?: Partial<ReviewPostingPort>;
  editedWhilePosting?: (comment: ReviewComment) => ReviewComment;
}) => {
  const comments = new Map(
    (over.comments ?? []).map((each) => [each.id.value, each]),
  );
  const reviews = new Map(
    (over.reviews ?? []).map((each) => [each.id.value, each]),
  );
  const recorded: { how: string; args: unknown[] }[] = [];
  const sendings: string[] = [];
  const { kind, subjectId, attempts, sendingSince } = over.delivery;
  let pending: LeasedReviewDelivery | null = {
    id: ReviewDeliveryId.of('delivery_1'),
    workspaceId: WORKSPACE,
    taskId: TASK,
    leaseUntil: NOW,
    sendingSince: sendingSince ?? null,
    attempts,
    ...(kind === 'review'
      ? { kind, subject: ReviewId.of(subjectId) }
      : { kind, subject: ReviewCommentId.of(subjectId) }),
  };

  const deliveries: ReviewDeliveriesPort = {
    enqueue: vi.fn(),
    leaseDue: async () => {
      const next = pending;
      pending = null;
      return next;
    },
    sending: async (delivery) => {
      sendings.push(delivery.id.value);
      return !over.leaseLost;
    },
    delivered: async (delivery) =>
      void recorded.push({ how: 'delivered', args: [delivery.id.value] }),
    retry: async (delivery, retry) =>
      void recorded.push({
        how: 'retry',
        args: [delivery.id.value, retry.at, retry.counted],
      }),
    failed: async (delivery) =>
      void recorded.push({ how: 'failed', args: [delivery.id.value] }),
    dropTask: async () => undefined,
  };

  const pullRequest = over.pullRequest === undefined ? PULL : over.pullRequest;
  const task = {
    id: TASK,
    workspaceId: WORKSPACE,
    teamId: null,
    pullRequest,
    pullRequests: over.pullRequests ?? (pullRequest ? [pullRequest] : []),
    reviewing: false,
    currentRunId: null,
  };

  const conflicts = new Set<string>();

  const github: ReviewPostingPort = {
    submit: vi.fn<ReviewPostingPort['submit']>(async (input) => ({
      githubId: 900,
      verdict: input.verdict,
      comments: input.comments.map((_, index) => ({
        id: 100 + index,
        url: `https://github.com/c/${100 + index}`,
      })),
    })),
    reply: vi.fn<ReviewPostingPort['reply']>(async (input) => {
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
  const service = new DeliverReviews(
    deliveries,
    {
      find: async (id) => reviews.get(id.value) ?? null,
      save: async (review) => {
        if (over.reviewSaveFails && review.state === 'posted') {
          throw new Error('The database could not be reached.');
        }
        reviews.set(review.id.value, review);
      },
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
      viewerOf: async () => null,
      actsOnTeam: async () => false,
    },
    github,
    { now: () => NOW, sleep: async () => {} },
    { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    reports,
  );

  return { service, recorded, sendings, github, comments, reviews, reports };
};

const submitted = () => {
  const { review, claimed } = Review.submit({
    id: ReviewId.of('review_1'),
    workspaceId: WORKSPACE,
    taskId: TASK,
    repository: null,
    author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
    verdict: 'request-changes',
    body: 'A few things',
    drafts: [draft('comment_1', 3), draft('comment_2', 9)],
    now: NOW,
  });
  return { review, comments: [...claimed] };
};

describe('DeliverReviews', () => {
  it('posts a submitted review with its comments, and stores where GitHub put them', async () => {
    const { review, comments } = submitted();
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: 'request-changes',
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
    expect(delivered.reviews.get('review_1')?.state).toBe('posted');
    expect(delivered.reviews.get('review_1')?.pullEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'review.posted' }),
        expect.objectContaining({
          kind: 'review.included-comment-posted',
          github: { id: 100, url: 'https://github.com/c/100' },
        }),
        expect.objectContaining({
          kind: 'review.included-comment-posted',
          github: { id: 101, url: 'https://github.com/c/101' },
        }),
      ]),
    );
    expect(delivered.recorded).toEqual([
      { how: 'delivered', args: ['delivery_1'] },
    ]);
  });

  it('posts an agent’s review as Spotlight itself, naming nobody', async () => {
    const agent = ReviewAuthor.agent(RunId.of('run_1'));
    const { review, claimed } = Review.submit({
      id: ReviewId.of('review_1'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      repository: null,
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
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments: [...claimed],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({ by: { kind: 'spotlight' } }),
    );
  });

  it('posts only the comments its own review contains', async () => {
    const { review, comments } = submitted();
    const second = Review.rehydrate({
      id: ReviewId.of('review_2'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      repository: null,
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      verdict: 'comment',
      body: 'Again',
      comments: review.comments,
      state: 'submitted',
      githubId: null,
      verdictOnGitHub: null,
      submittedAt: NOW,
      postedAt: null,
      failure: null,
      version: 0,
    });
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_2', attempts: 0 },
      reviews: [review, second],
      comments,
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Again', comments: [] }),
    );
  });

  it('waits, without counting it a failure, until the task has a pull request', async () => {
    const { review, comments } = submitted();
    const delivered = delivering({
      pullRequest: null,
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).not.toHaveBeenCalled();
    expect(delivered.recorded).toEqual([
      {
        how: 'retry',
        args: ['delivery_1', new Date(NOW.getTime() + 60_000), false],
      },
    ]);
  });

  it('retries later where GitHub answers with an error, then gives up', async () => {
    const { review, comments } = submitted();
    const failing = {
      submit: vi.fn(async () => {
        throw new ReviewPostingFailedError(
          DeliveryFailure.of('github-unreachable'),
        );
      }),
    };

    const early = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 1 },
      reviews: [review],
      comments,
      github: failing,
    });
    await early.service.deliverDue();

    expect(early.reports.report).not.toHaveBeenCalled();
    expect(early.recorded).toEqual([
      {
        how: 'retry',
        args: ['delivery_1', new Date(NOW.getTime() + 60_000), true],
      },
    ]);

    const last = delivering({
      delivery: {
        kind: 'review',
        subjectId: 'review_1',
        attempts: MAX_ATTEMPTS - 1,
      },
      reviews: [review],
      comments,
      github: failing,
    });
    await last.service.deliverDue();

    expect(last.recorded).toEqual([{ how: 'failed', args: ['delivery_1'] }]);
    expect(last.reviews.get('review_1')?.state).toBe('failed');
    expect(last.reviews.get('review_1')?.failure).toEqual(
      DeliveryFailure.of('github-unreachable'),
    );
    expect(last.reviews.get('review_1')?.pullEvents()).toContainEqual(
      expect.objectContaining({ kind: 'review.included-comment-returned' }),
    );
    expect(last.reports.report).toHaveBeenCalledExactlyOnceWith(
      expect.any(ReviewPostingFailedError),
      expect.objectContaining({ source: 'Delivering reviews to GitHub' }),
    );
  });

  it('fails a delivery at once where something unexpected goes wrong, and shows no error text', async () => {
    const { review, comments } = submitted();
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
      github: {
        submit: vi.fn(async () => {
          throw new Error('Cannot read properties of undefined');
        }),
      },
    });

    await delivered.service.deliverDue();

    expect(delivered.recorded).toEqual([
      { how: 'failed', args: ['delivery_1'] },
    ]);
    expect(delivered.reviews.get('review_1')?.failure).toEqual(
      DeliveryFailure.of('unexpected'),
    );
  });

  it('never posts a review twice where recording the first post failed', async () => {
    const { review, comments } = submitted();
    const first = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
      reviewSaveFails: true,
    });

    await first.service.deliverDue();

    expect(first.github.submit).toHaveBeenCalledOnce();
    expect(first.sendings).toEqual(['delivery_1']);
    expect(first.recorded).toEqual([{ how: 'failed', args: ['delivery_1'] }]);
    expect(first.reviews.get('review_1')?.failure).toEqual(
      DeliveryFailure.of('not-recorded'),
    );

    const again = delivering({
      delivery: {
        kind: 'review',
        subjectId: 'review_1',
        attempts: 1,
        sendingSince: NOW,
      },
      reviews: [review],
      comments,
    });

    await again.service.deliverDue();

    expect(again.github.submit).not.toHaveBeenCalled();
    expect(again.recorded).toEqual([{ how: 'failed', args: ['delivery_1'] }]);
  });

  it('does not post where another worker took the delivery over', async () => {
    const { review, comments } = submitted();
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
      leaseLost: true,
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).not.toHaveBeenCalled();
    expect(delivered.recorded).toEqual([]);
    expect(delivered.reviews.get('review_1')?.state).toBe('submitted');
  });

  it('never posts again where GitHub sent no answer to a post', async () => {
    const { review, comments } = submitted();
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
      github: {
        submit: vi.fn(async () => {
          throw new ReviewPostingFailedError(
            DeliveryFailure.of('github-unreachable'),
            { outcomeUnknown: true },
          );
        }),
      },
    });

    await delivered.service.deliverDue();

    expect(delivered.recorded).toEqual([
      { how: 'failed', args: ['delivery_1'] },
    ]);
    expect(delivered.reviews.get('review_1')?.failure).toEqual(
      DeliveryFailure.of('not-recorded'),
    );
  });

  it('settles a delivery whose review no longer exists, with nothing to mark', async () => {
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_gone', attempts: 0 },
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).not.toHaveBeenCalled();
    expect(delivered.recorded).toEqual([
      { how: 'failed', args: ['delivery_1'] },
    ]);
    expect(delivered.reviews.size).toBe(0);
  });

  it('discards a review whose every comment was deleted on its way, without calling GitHub', async () => {
    const { review, comments } = submitted();
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [
        Review.submit({
          id: review.id,
          workspaceId: WORKSPACE,
          taskId: TASK,
          repository: null,
          author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
          verdict: 'comment',
          body: '',
          drafts: [draft('comment_1', 3), draft('comment_2', 9)],
          now: NOW,
        }).review,
      ],
      comments: comments.map((each) => each.deleted(ADA)),
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).not.toHaveBeenCalled();
    expect(delivered.reviews.get('review_1')?.state).toBe('discarded');
    expect(delivered.reviews.get('review_1')?.pullEvents()).toContainEqual(
      expect.objectContaining({ kind: 'review.included-comment-returned' }),
    );
    expect(delivered.recorded).toEqual([
      { how: 'delivered', args: ['delivery_1'] },
    ]);
  });

  it('fails a reply to a comment whose review was never posted to GitHub', async () => {
    const sending = draft('comment_1', 3).submittedIn(ReviewId.of('review_1'));
    const reply = sending.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });
    const delivered = delivering({
      delivery: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [sending.returnedToDraftFrom(ReviewId.of('review_1')), reply],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.reply).not.toHaveBeenCalled();
    expect(delivered.recorded[0]?.how).toBe('failed');
    expect(delivered.comments.get('comment_2')?.state).toBe('failed');
    expect(delivered.comments.get('comment_2')?.failure?.code).toBe(
      'parent-never-on-github',
    );
  });

  it('stops waiting for the comment a reply answers after a while', async () => {
    const sending = draft('comment_1', 3).submittedIn(ReviewId.of('review_1'));
    const reply = sending.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });

    const waiting = delivering({
      delivery: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [sending, reply],
    });
    await waiting.service.deliverDue();

    expect(waiting.recorded).toEqual([
      {
        how: 'retry',
        args: ['delivery_1', new Date(NOW.getTime() + 60_000), true],
      },
    ]);

    const tired = delivering({
      delivery: {
        kind: 'reply',
        subjectId: 'comment_2',
        attempts: MAX_WAITS_FOR_THREAD - 1,
      },
      comments: [sending, reply],
    });
    await tired.service.deliverDue();

    expect(tired.recorded[0]?.how).toBe('failed');
    expect(tired.comments.get('comment_2')?.state).toBe('failed');
    expect(tired.comments.get('comment_2')?.failure?.code).toBe(
      'parent-not-on-github',
    );
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
      repository: null,
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      verdict: 'comment',
      body: '',
      drafts: [draft('comment_1', 3), onFile],
      now: NOW,
    });
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments: [...claimed],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: [expect.objectContaining({ line: 3 })],
      }),
    );
    expect(delivered.github.commentOnFile).not.toHaveBeenCalled();
    expect(delivered.reviews.get('review_1')?.pullEvents()).toContainEqual(
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
    const delivered = delivering({
      delivery: { kind: 'file', subjectId: 'comment_3', attempts: 0 },
      comments: [onFile],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.commentOnFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'src/a.ts', body: 'About the file' }),
    );
    expect(delivered.comments.get('comment_3')?.state).toBe('posted');
    expect(delivered.comments.get('comment_3')?.github?.id).toBe(777);

    await delivered.service.deliverDue();

    expect(delivered.github.commentOnFile).toHaveBeenCalledTimes(1);
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
    const delivered = delivering({
      delivery: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [parent, reply],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.reply).toHaveBeenCalledWith(
      expect.objectContaining({ thread: 77, body: 'Done' }),
    );
    expect(delivered.comments.get('comment_2')?.github?.id).toBe(555);
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
    const delivered = delivering({
      delivery: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [parent, reply],
      editedWhilePosting: (comment) =>
        comment.edited('Done, and tested', ADA, NOW),
    });

    await delivered.service.deliverDue();

    const stored = delivered.comments.get('comment_2');
    expect(delivered.github.reply).toHaveBeenCalledTimes(1);
    expect(stored?.github?.id).toBe(555);
    expect(stored?.body).toBe('Done, and tested');
    expect(stored?.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'review-comment.edited',
        onGitHub: true,
      }),
    );
    expect(delivered.recorded).toEqual([
      { how: 'delivered', args: ['delivery_1'] },
    ]);

    const again = delivering({
      delivery: { kind: 'reply', subjectId: 'comment_2', attempts: 1 },
      comments: [parent, stored as ReviewComment],
    });
    await again.service.deliverDue();

    expect(again.github.reply).not.toHaveBeenCalled();
  });

  it('posts a comment as it was submitted, and leaves out one deleted before it was sent', async () => {
    const { review, comments } = submitted();
    const [first, second] = comments as [ReviewComment, ReviewComment];
    const delivered = delivering({
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments: [first.edited('Clearer', ADA, NOW), second.deleted(ADA)],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: [expect.objectContaining({ line: 3, body: 'About line 3' })],
      }),
    );
    expect(delivered.reviews.get('review_1')?.pullEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'review.included-comment-posted',
          github: { id: 100, url: 'https://github.com/c/100' },
        }),
        expect.objectContaining({
          kind: 'review.included-comment-posted',
          commentId: second.id,
          github: null,
        }),
      ]),
    );
  });

  it('does not send a reply while the comment it answers is still on its way', async () => {
    const parent = draft('comment_1', 3).submittedIn(ReviewId.of('review_1'));
    const reply = parent.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });
    const delivered = delivering({
      delivery: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [parent, reply],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.reply).not.toHaveBeenCalled();
    expect(delivered.recorded[0]?.how).toBe('retry');
  });

  it('carries an edit and a deletion to the comment on GitHub', async () => {
    const posted = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' })
      .edited('Clearer', ADA, NOW);

    const edited = delivering({
      delivery: { kind: 'edit', subjectId: 'comment_1', attempts: 0 },
      comments: [posted],
    });
    await edited.service.deliverDue();

    expect(edited.github.edit).toHaveBeenCalledWith(
      expect.objectContaining({ commentId: 77, body: 'Clearer' }),
    );

    const deleted = delivering({
      delivery: { kind: 'delete', subjectId: 'comment_1', attempts: 0 },
      comments: [posted.deleted(ADA)],
    });
    await deleted.service.deliverDue();

    expect(deleted.github.remove).toHaveBeenCalledWith(
      expect.objectContaining({ commentId: 77 }),
    );
  });

  it('remembers the edit it sent, and still has to send one made while sending it', async () => {
    const posted = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' })
      .edited('First', ADA, NOW);
    let delivered: ReturnType<typeof delivering> | null = null;

    delivered = delivering({
      delivery: { kind: 'edit', subjectId: 'comment_1', attempts: 0 },
      comments: [posted],
      github: {
        edit: vi.fn(async () => {
          delivered?.comments.set(
            'comment_1',
            posted.edited('Second', ADA, NOW),
          );
        }),
      },
    });
    await delivered.service.deliverDue();

    const stored = delivered.comments.get('comment_1');
    expect(stored?.body).toBe('Second');
    expect(stored?.editPending).toBe(true);
    expect(stored?.pendingOwnEdits).toEqual(['First']);
  });

  it('drops a pending edit GitHub would never take', async () => {
    const pending = draft('comment_1', 3)
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' })
      .edited('Clearer', ADA, NOW);
    const delivered = delivering({
      delivery: {
        kind: 'edit',
        subjectId: 'comment_1',
        attempts: MAX_ATTEMPTS,
      },
      comments: [pending],
      github: {
        edit: vi.fn(async () => {
          throw new ReviewPostingFailedError(
            DeliveryFailure.of('github-rejected', 'Validation Failed'),
          );
        }),
      },
    });

    await delivered.service.deliverDue();

    expect(delivered.recorded[0]?.how).toBe('failed');
    expect(delivered.comments.get('comment_1')?.editPending).toBe(false);
  });
});

describe('DeliverReviews, on a task with a pull request per repository', () => {
  const DOCS = PullRequestUrl.of('https://github.com/acme/docs/pull/3');
  const BOTH = [PULL, DOCS] as const;
  const IN_DOCS = RepositoryName.of('docs');

  const inDocs = (
    id: string,
    anchor = ReviewAnchor.onFile('guide.md', IN_DOCS),
  ) =>
    ReviewComment.draft({
      id: ReviewCommentId.of(id),
      workspaceId: WORKSPACE,
      taskId: TASK,
      anchor,
      body: 'About the guide',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });

  it('posts a review on the pull request of its repository', async () => {
    const { review, claimed } = Review.submit({
      id: ReviewId.of('review_1'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      repository: IN_DOCS,
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      verdict: 'comment',
      body: 'Docs read well',
      drafts: [
        inDocs(
          'comment_1',
          ReviewAnchor.onLines({
            repository: IN_DOCS,
            path: 'guide.md',
            side: 'new',
            line: 2,
          }),
        ),
        draft('comment_2', 3),
      ],
      now: NOW,
    });
    const delivered = delivering({
      pullRequests: BOTH,
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments: [...claimed],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequest: DOCS }),
    );
  });

  it('posts a review that names no repository on the task’s first pull request', async () => {
    const { review, comments } = submitted();
    const delivered = delivering({
      pullRequests: BOTH,
      delivery: { kind: 'review', subjectId: 'review_1', attempts: 0 },
      reviews: [review],
      comments,
    });

    await delivered.service.deliverDue();

    expect(delivered.github.submit).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequest: PULL }),
    );
  });

  it('posts a comment on a whole file on the pull request of its repository', async () => {
    const delivered = delivering({
      pullRequests: BOTH,
      delivery: { kind: 'file', subjectId: 'comment_1', attempts: 0 },
      comments: [inDocs('comment_1').submittedIn(ReviewId.of('review_1'))],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.commentOnFile).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequest: DOCS, path: 'guide.md' }),
    );
  });

  it('replies, edits and deletes on the pull request of the comment’s repository', async () => {
    const parent = inDocs('comment_1')
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 77, url: 'https://github.com/c/77' });
    const reply = parent.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Done',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });

    const replied = delivering({
      pullRequests: BOTH,
      delivery: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [parent, reply],
    });
    await replied.service.deliverDue();

    const edited = delivering({
      pullRequests: BOTH,
      delivery: { kind: 'edit', subjectId: 'comment_1', attempts: 0 },
      comments: [parent.edited('Clearer', ADA, NOW)],
    });
    await edited.service.deliverDue();

    const deleted = delivering({
      pullRequests: BOTH,
      delivery: { kind: 'delete', subjectId: 'comment_1', attempts: 0 },
      comments: [parent.deleted(ADA)],
    });
    await deleted.service.deliverDue();

    expect(replied.github.reply).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequest: DOCS, thread: 77 }),
    );
    expect(edited.github.edit).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequest: DOCS, commentId: 77 }),
    );
    expect(deleted.github.remove).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequest: DOCS, commentId: 77 }),
    );
  });

  it('answers a comment from GitHub on the pull request it came from, whatever its repository says', async () => {
    const received = ReviewComment.receive({
      id: ReviewCommentId.of('comment_1'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      anchor: ReviewAnchor.onFile('guide.md', RepositoryName.of('web')),
      body: 'Why?',
      author: ReviewAuthor.onGitHub('octocat'),
      inReplyTo: null,
      github: { id: 77, url: `${DOCS.value}#discussion_r77` },
      at: NOW,
    });
    const reply = received.replied({
      id: ReviewCommentId.of('comment_2'),
      body: 'Because',
      author: ReviewAuthor.person(ADA, AuthorName.of('Ada')),
      now: NOW,
    });
    const delivered = delivering({
      pullRequests: BOTH,
      delivery: { kind: 'reply', subjectId: 'comment_2', attempts: 0 },
      comments: [received, reply],
    });

    await delivered.service.deliverDue();

    expect(delivered.github.reply).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequest: DOCS }),
    );
  });
});
