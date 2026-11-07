import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewOutboxEntry,
  ReviewOutboxPort,
} from '@change-review/application/ports/review-outbox.port';
import type { ReviewOutboxWorkPort } from '@change-review/application/ports/review-outbox-work.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { ReviewCommentVersionConflictError } from '@change-review/domain/exceptions/review-comment-version-conflict.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import {
  DeliveryFailure,
  type DeliveryFailureCode,
} from '@change-review/domain/value-objects/delivery-failure.vo';
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import {
  type OnPullRequest,
  type PullRequestReviewsPort,
  SPOTLIGHT_ACTOR,
} from '@github/application/ports/pull-request-reviews.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export const MAX_ATTEMPTS = 6;

export const MAX_WAITS_FOR_THREAD = 30;

const AT_A_TIME = 10;

const BACKOFF_MS = 30_000;

const LEASE_MS = 10 * 60 * 1000;

const WAIT_FOR_PULL_REQUEST_MS = 60_000;

const MAX_SYNC_ATTEMPTS = 5;

class NotYet extends Error {
  constructor(
    readonly why: string,
    readonly failure: DeliveryFailure | null = null,
  ) {
    super(why);
  }
}

class PermanentSyncFailure extends Error {
  readonly failure: DeliveryFailure;

  constructor(code: DeliveryFailureCode) {
    super(`Syncing with GitHub failed: ${code}`);
    this.failure = DeliveryFailure.of(code);
  }
}

const failureOf = (error: unknown): DeliveryFailure => {
  if (error instanceof PermanentSyncFailure) {
    return error.failure;
  }
  if (error instanceof NotYet && error.failure) {
    return error.failure;
  }

  return DeliveryFailure.of(
    'github-error',
    error instanceof Error ? error.message : null,
  );
};

export class SyncReviews implements ReviewOutboxWorkPort {
  constructor(
    private readonly outbox: ReviewOutboxPort,
    private readonly reviews: ReviewRepository,
    private readonly comments: ReviewCommentRepository,
    private readonly work: WorkPort,
    private readonly connections: WorkspaceConnectionsPort,
    private readonly people: PeoplePort,
    private readonly github: PullRequestReviewsPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    private readonly reports: ErrorReportsPort,
  ) {}

  async syncDue(): Promise<void> {
    for (let turn = 0; turn < AT_A_TIME; turn += 1) {
      const synced = await this.syncNext();

      if (!synced) {
        return;
      }
    }
  }

  private async syncNext(): Promise<boolean> {
    const now = this.clock.now();
    const sync = await this.outbox.claimDue(
      now,
      new Date(now.getTime() + LEASE_MS),
    );

    if (!sync) {
      return false;
    }

    try {
      await this.perform(sync);
      await this.outbox.done(sync);
    } catch (error) {
      await this.recordFailure(sync, error, now);
    }

    return true;
  }

  private async recordFailure(
    sync: ReviewOutboxEntry,
    error: unknown,
    now: Date,
  ): Promise<void> {
    if (error instanceof NotYet) {
      if (!error.failure || sync.attempts + 1 < MAX_WAITS_FOR_THREAD) {
        await this.outbox.later(
          sync,
          new Date(now.getTime() + WAIT_FOR_PULL_REQUEST_MS),
          error.failure !== null,
        );
        return;
      }
    }

    this.logger.warn(
      { syncId: sync.id, kind: sync.kind, attempts: sync.attempts, err: error },
      'Syncing a review with GitHub',
    );

    if (
      error instanceof PermanentSyncFailure ||
      error instanceof NotYet ||
      sync.attempts + 1 >= MAX_ATTEMPTS
    ) {
      await this.markNotSent(sync, failureOf(error));
      await this.outbox.failed(sync);
      this.reports.report(error, {
        source: 'Syncing reviews with GitHub',
        workspaceId: sync.workspaceId.value,
        taskId: sync.taskId.value,
      });
      return;
    }

    await this.outbox.later(
      sync,
      new Date(now.getTime() + BACKOFF_MS * 2 ** sync.attempts),
      true,
    );
  }

  private async markNotSent(
    sync: ReviewOutboxEntry,
    failure: DeliveryFailure,
  ): Promise<void> {
    if (sync.kind === 'review') {
      const review = await this.reviews.find(ReviewId.of(sync.subjectId));

      if (review) {
        await this.reviews.save(review.failedToPost(failure));
      }
      return;
    }

    const id = ReviewCommentId.of(sync.subjectId);

    if (sync.kind === 'reply' || sync.kind === 'file') {
      await this.saveWithRetry(id, (comment) => comment.notPosted(failure));
    } else if (sync.kind === 'edit') {
      await this.saveWithRetry(id, (comment) => comment.editNotSent());
    }
  }

  private async perform(sync: ReviewOutboxEntry): Promise<void> {
    const task = await this.work.task(sync.taskId);

    if (!task) {
      throw new PermanentSyncFailure('task-deleted');
    }
    if (!task.pullRequest) {
      throw new NotYet('The task has no pull request yet.');
    }

    if (!(await this.connections.isConnected(task.workspaceId))) {
      throw new PermanentSyncFailure('not-connected');
    }

    const on = async (author: ReviewAuthor): Promise<OnPullRequest> => ({
      workspaceId: task.workspaceId,
      pullRequest: task.pullRequest as NonNullable<typeof task.pullRequest>,
      by: author.userId
        ? {
            kind: 'person',
            userId: author.userId,
            name:
              (await this.people.find(author.userId))?.name ??
              author.name.value,
          }
        : SPOTLIGHT_ACTOR,
    });

    if (sync.kind === 'review') {
      await this.postReview(sync, on);
      return;
    }

    const comment = await this.comments.find(
      ReviewCommentId.of(sync.subjectId),
    );

    if (!comment) {
      throw new PermanentSyncFailure('subject-deleted');
    }
    if (!comment.deliveredAlone) {
      return;
    }

    const target = await on(comment.author);

    if (sync.kind === 'reply') {
      await this.postReply(comment, target);
      return;
    }

    if (sync.kind === 'file') {
      await this.postOnFile(comment, target);
      return;
    }

    if (!comment.github) {
      throw new PermanentSyncFailure('never-on-github');
    }

    if (sync.kind === 'edit') {
      const body = comment.body;

      await this.github.edit({
        ...target,
        commentId: comment.github.id,
        body,
      });
      await this.saveWithRetry(comment.id, (latest) => latest.editSent(body));
      return;
    }

    await this.github.remove({ ...target, commentId: comment.github.id });
  }

  private async postReview(
    sync: ReviewOutboxEntry,
    on: (author: ReviewAuthor) => Promise<OnPullRequest>,
  ): Promise<void> {
    const review = await this.reviews.find(ReviewId.of(sync.subjectId));

    if (!review) {
      throw new PermanentSyncFailure('subject-deleted');
    }
    if (review.state !== 'submitted') {
      return;
    }

    const comments = await Promise.all(
      review.comments.map((id) => this.comments.find(id)),
    );
    const plan = review.postingPlan(comments);

    if (plan.empty) {
      await this.reviews.save(review.discard(comments));
      return;
    }

    const submitted = await this.github.submit({
      ...(await on(review.author)),
      event: review.verdict,
      body: review.body,
      comments: plan.onLines.flatMap((comment) =>
        comment.anchor.lines
          ? [
              {
                path: comment.anchor.path.value,
                side: comment.anchor.lines.side,
                line: comment.anchor.lines.line,
                startLine: comment.anchor.lines.startLine,
                body: comment.sentBody ?? comment.body,
              },
            ]
          : [],
      ),
    });

    await this.reviews.save(
      review.postedAs({
        githubId: submitted.githubId,
        verdictOnGitHub: submitted.postedAs,
        comments,
        onLinesOnGitHub: submitted.comments,
        now: this.clock.now(),
      }),
    );
  }

  private async postReply(
    reply: ReviewComment,
    target: OnPullRequest,
  ): Promise<void> {
    if (!reply.sending) {
      return;
    }
    if (reply.state === 'deleted') {
      await this.saveWithRetry(reply.id, (latest) => latest.postedAs(null));
      return;
    }

    const parent = reply.replyTo
      ? await this.comments.find(reply.replyTo)
      : null;

    if (!parent || parent.state === 'deleted') {
      throw new PermanentSyncFailure('parent-deleted');
    }
    if (parent.sending) {
      throw new NotYet(
        'The comment that this reply answers isn’t on GitHub yet.',
        DeliveryFailure.of('parent-not-on-github'),
      );
    }

    const thread = parent.threadOnGitHub;

    if (!thread) {
      throw new PermanentSyncFailure('parent-never-on-github');
    }

    const posted = await this.github.reply({
      ...target,
      to: thread.id,
      body: reply.sentBody ?? reply.body,
    });

    await this.saveWithRetry(reply.id, (latest) => latest.postedAs(posted));
  }

  private async postOnFile(
    comment: ReviewComment,
    target: OnPullRequest,
  ): Promise<void> {
    if (!comment.sending) {
      return;
    }
    if (comment.state === 'deleted') {
      await this.saveWithRetry(comment.id, (latest) => latest.postedAs(null));
      return;
    }

    const posted = await this.github.commentOnFile({
      ...target,
      path: comment.anchor.path.value,
      body: comment.sentBody ?? comment.body,
    });

    await this.saveWithRetry(comment.id, (latest) => latest.postedAs(posted));
  }

  private async saveWithRetry(
    id: ReviewComment['id'],
    change: (latest: ReviewComment) => ReviewComment,
  ): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      const latest = await this.comments.find(id);

      if (!latest) {
        return;
      }

      try {
        await this.comments.save(change(latest));
        return;
      } catch (error) {
        if (
          !(error instanceof ReviewCommentVersionConflictError) ||
          attempt >= MAX_SYNC_ATTEMPTS
        ) {
          throw new PermanentSyncFailure('not-recorded');
        }
      }
    }
  }
}
