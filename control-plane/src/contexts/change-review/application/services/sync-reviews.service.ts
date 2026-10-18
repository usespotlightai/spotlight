import type { GitHubConnectionsPort } from '@change-review/application/ports/github-connections.port';
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
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import {
  type OnPullRequest,
  type PullRequestReviewsPort,
  SPOTLIGHT_ACTOR,
} from '@github/application/ports/pull-request-reviews.port';
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
    readonly counted = false,
  ) {
    super(why);
  }
}

class PermanentSyncFailure extends Error {}

export class SyncReviews implements ReviewOutboxWorkPort {
  constructor(
    private readonly outbox: ReviewOutboxPort,
    private readonly reviews: ReviewRepository,
    private readonly comments: ReviewCommentRepository,
    private readonly work: WorkPort,
    private readonly connections: GitHubConnectionsPort,
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
      await this.outbox.done(sync.id);
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
      if (!error.counted || sync.attempts + 1 < MAX_WAITS_FOR_THREAD) {
        await this.outbox.later(
          sync.id,
          new Date(now.getTime() + WAIT_FOR_PULL_REQUEST_MS),
          null,
          error.counted,
        );
        return;
      }
    }

    const failure =
      error instanceof Error
        ? error.message
        : 'Spotlight couldn’t reach GitHub.';

    this.logger.warn(
      { syncId: sync.id, kind: sync.kind, attempts: sync.attempts, err: error },
      'Syncing a review with GitHub',
    );

    if (
      error instanceof PermanentSyncFailure ||
      error instanceof NotYet ||
      sync.attempts + 1 >= MAX_ATTEMPTS
    ) {
      await this.markNotSent(sync);
      await this.outbox.failed(sync.id, failure);
      this.reports.report(error, {
        source: 'Syncing reviews with GitHub',
        workspaceId: sync.workspaceId.value,
        taskId: sync.taskId.value,
      });
      return;
    }

    await this.outbox.later(
      sync.id,
      new Date(now.getTime() + BACKOFF_MS * 2 ** sync.attempts),
      failure,
      true,
    );
  }

  private async markNotSent(sync: ReviewOutboxEntry): Promise<void> {
    if (sync.kind === 'review') {
      const review = await this.reviews.find(ReviewId.of(sync.subjectId));

      if (review) {
        await this.reviews.save(review.failedToPost());
      }
      return;
    }

    const id = ReviewCommentId.of(sync.subjectId);

    if (sync.kind === 'reply' || sync.kind === 'file') {
      await this.saveWithRetry(id, (comment) => comment.notPosted());
    } else if (sync.kind === 'edit') {
      await this.saveWithRetry(id, (comment) => comment.editNotSent());
    }
  }

  private async perform(sync: ReviewOutboxEntry): Promise<void> {
    const task = await this.work.task(sync.taskId);

    if (!task) {
      throw new PermanentSyncFailure('The task no longer exists.');
    }
    if (!task.pullRequest) {
      throw new NotYet('The task has no pull request yet.');
    }

    if (!(await this.connections.isConnected(task.workspaceId))) {
      throw new PermanentSyncFailure(
        'The workspace isn’t connected to GitHub.',
      );
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

    if (!comment?.author.userId) {
      throw new PermanentSyncFailure('The comment no longer exists.');
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
      throw new PermanentSyncFailure('The comment was never posted to GitHub.');
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
      throw new PermanentSyncFailure('The review no longer exists.');
    }
    if (review.state !== 'submitted') {
      return;
    }

    const ownComments = (
      await Promise.all(review.comments.map((id) => this.comments.find(id)))
    ).flatMap((comment) =>
      comment?.sending && comment.belongsTo(review.id) ? [comment] : [],
    );
    const sent = ownComments.filter((comment) => comment.state === 'submitted');
    const deleted = ownComments.filter(
      (comment) => comment.state === 'deleted',
    );

    if (review.isEmpty(sent)) {
      await this.reviews.save(review.discard(sent));
      return;
    }

    const onLines = sent.flatMap((comment) =>
      comment.anchor.lines ? [{ comment, lines: comment.anchor.lines }] : [],
    );
    const onFiles = sent.filter((comment) => comment.anchor.wholeFile);

    const submitted = await this.github.submit({
      ...(await on(review.author)),
      event: review.verdict,
      body: review.body,
      comments: onLines.map(({ comment, lines }) => ({
        path: comment.anchor.path.value,
        side: lines.side,
        line: lines.line,
        startLine: lines.startLine,
        body: comment.sentBody ?? comment.body,
      })),
    });

    const now = this.clock.now();

    await this.reviews.save(
      review.postedAs(
        submitted.githubId,
        now,
        [
          ...onLines.map(({ comment }, position) => ({
            commentId: comment.id,
            github: submitted.comments[position] ?? null,
          })),
          ...deleted.map((comment) => ({
            commentId: comment.id,
            github: null,
          })),
        ],
        onFiles.map((comment) => comment.id),
      ),
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
      throw new PermanentSyncFailure(
        'The comment that this reply answers no longer exists.',
      );
    }
    if (parent.sending) {
      throw new NotYet(
        'The comment that this reply answers isn’t on GitHub yet.',
        true,
      );
    }

    const thread = parent.threadOnGitHub;

    if (!thread) {
      throw new PermanentSyncFailure(
        'The comment that this reply answers was never posted to GitHub.',
      );
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
          throw new PermanentSyncFailure(
            error instanceof Error
              ? error.message
              : 'Spotlight couldn’t save the comment that it posted to GitHub.',
          );
        }
      }
    }
  }
}
