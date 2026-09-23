import type { GitHubConnectionsPort } from '@change-review/application/ports/github-connections.port';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewOutboxPort,
  ReviewSync,
} from '@change-review/application/ports/review-outbox.port';
import type { ReviewSyncWorkPort } from '@change-review/application/ports/review-sync-work.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { ChangedSinceReadError } from '@change-review/domain/exceptions/changed-since-read.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import {
  type OnPullRequest,
  type PullRequestReviewsPort,
  SPOTLIGHT_WRITES,
} from '@github/application/ports/pull-request-reviews.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export const MOST_ATTEMPTS = 6;

export const MOST_WAITS_FOR_THREAD = 30;

const AT_A_TIME = 10;

const BACKOFF_MS = 30_000;

const LEASE_MS = 10 * 60 * 1000;

const WAIT_FOR_PULL_REQUEST_MS = 60_000;

const KEEPING_ATTEMPTS = 5;

class NotYet extends Error {
  constructor(
    readonly why: string,
    readonly counted = false,
  ) {
    super(why);
  }
}

class GaveUp extends Error {}

export class SyncReviews implements ReviewSyncWorkPort {
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
      await this.settleFailure(sync, error, now);
    }

    return true;
  }

  private async settleFailure(
    sync: ReviewSync,
    error: unknown,
    now: Date,
  ): Promise<void> {
    if (error instanceof NotYet) {
      if (!error.counted || sync.attempts + 1 < MOST_WAITS_FOR_THREAD) {
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
      error instanceof Error ? error.message : 'GitHub could not be reached';

    this.logger.warn(
      { syncId: sync.id, kind: sync.kind, attempts: sync.attempts, err: error },
      'Syncing a review with GitHub',
    );

    if (
      error instanceof GaveUp ||
      error instanceof NotYet ||
      sync.attempts + 1 >= MOST_ATTEMPTS
    ) {
      await this.abandon(sync);
      await this.outbox.failed(sync.id, failure);
      return;
    }

    await this.outbox.later(
      sync.id,
      new Date(now.getTime() + BACKOFF_MS * 2 ** sync.attempts),
      failure,
      true,
    );
  }

  private async abandon(sync: ReviewSync): Promise<void> {
    if (sync.kind === 'review') {
      const review = await this.reviews.find(ReviewId.of(sync.subjectId));

      if (review) {
        await this.reviews.save(review.failedToPost());
      }
      return;
    }

    const id = ReviewCommentId.of(sync.subjectId);

    if (sync.kind === 'reply' || sync.kind === 'file') {
      await this.keep(id, (comment) => comment.notPosted());
    } else if (sync.kind === 'edit') {
      await this.keep(id, (comment) => comment.editNotSent());
    }
  }

  private async perform(sync: ReviewSync): Promise<void> {
    const task = await this.work.task(sync.taskId);

    if (!task) {
      throw new GaveUp('The task is gone');
    }
    if (!task.pullRequest) {
      throw new NotYet('The task has no pull request yet');
    }

    if (!(await this.connections.isConnected(task.workspaceId))) {
      throw new GaveUp('The workspace is not connected to GitHub');
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
        : SPOTLIGHT_WRITES,
    });

    if (sync.kind === 'review') {
      await this.postReview(sync, on);
      return;
    }

    const comment = await this.comments.find(
      ReviewCommentId.of(sync.subjectId),
    );

    if (!comment?.author.userId) {
      throw new GaveUp('The comment is gone');
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
      throw new GaveUp('The comment was never on GitHub');
    }

    if (sync.kind === 'edit') {
      const body = comment.body;

      await this.github.edit({
        ...target,
        commentId: comment.github.id,
        body,
      });
      await this.keep(comment.id, (latest) => latest.editSent(body));
      return;
    }

    await this.github.remove({ ...target, commentId: comment.github.id });
  }

  private async postReview(
    sync: ReviewSync,
    on: (author: ReviewAuthor) => Promise<OnPullRequest>,
  ): Promise<void> {
    const review = await this.reviews.find(ReviewId.of(sync.subjectId));

    if (!review) {
      throw new GaveUp('The review is gone');
    }
    if (review.state !== 'submitted') {
      return;
    }

    const held = (
      await Promise.all(review.comments.map((id) => this.comments.find(id)))
    ).flatMap((comment) =>
      comment?.sending && comment.heldBy(review.id) ? [comment] : [],
    );
    const sent = held.filter((comment) => comment.state === 'submitted');
    const withdrawn = held.filter((comment) => comment.state === 'deleted');

    if (review.silentWith(sent)) {
      await this.reviews.save(review.withdrawn(sent));
      return;
    }

    const onLines = sent.flatMap((comment) =>
      comment.anchor.lines ? [{ comment, lines: comment.anchor.lines }] : [],
    );
    const onFiles = sent.filter((comment) => comment.anchor.wholeFile);

    const submitted = await this.github.submit({
      ...(await on(review.author)),
      verdict: review.verdict,
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
          ...onLines.map(({ comment }, place) => ({
            commentId: comment.id,
            github: submitted.comments[place] ?? null,
          })),
          ...withdrawn.map((comment) => ({
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
      await this.keep(reply.id, (latest) => latest.postedAs(null));
      return;
    }

    const parent = reply.replyTo
      ? await this.comments.find(reply.replyTo)
      : null;

    if (!parent || parent.state === 'deleted') {
      throw new GaveUp('The comment it answers is gone');
    }
    if (parent.sending) {
      throw new NotYet('The comment it answers is not on GitHub yet', true);
    }
    if (parent.state !== 'posted') {
      throw new GaveUp('The comment it answers never reached GitHub');
    }
    if (!parent.github) {
      throw new GaveUp('The comment it answers is not a thread on GitHub');
    }

    const posted = await this.github.reply({
      ...target,
      to: parent.github.id,
      body: reply.sentBody ?? reply.body,
    });

    await this.keep(reply.id, (latest) => latest.postedAs(posted));
  }

  private async postOnFile(
    comment: ReviewComment,
    target: OnPullRequest,
  ): Promise<void> {
    if (!comment.sending) {
      return;
    }
    if (comment.state === 'deleted') {
      await this.keep(comment.id, (latest) => latest.postedAs(null));
      return;
    }

    const posted = await this.github.commentOnFile({
      ...target,
      path: comment.anchor.path.value,
      body: comment.sentBody ?? comment.body,
    });

    await this.keep(comment.id, (latest) => latest.postedAs(posted));
  }

  private async keep(
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
          !(error instanceof ChangedSinceReadError) ||
          attempt >= KEEPING_ATTEMPTS
        ) {
          throw new GaveUp(
            error instanceof Error
              ? error.message
              : 'What reached GitHub could not be kept',
          );
        }
      }
    }
  }
}
