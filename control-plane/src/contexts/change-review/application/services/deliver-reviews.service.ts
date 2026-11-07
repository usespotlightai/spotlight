import { ReviewPostingFailedError } from '@change-review/application/errors/review-posting-failed.error';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  LeasedReviewDelivery,
  ReviewDeliveriesPort,
} from '@change-review/application/ports/review-deliveries.port';
import type { ReviewDeliveryWorkPort } from '@change-review/application/ports/review-delivery-work.port';
import type { ReviewPostingPort } from '@change-review/application/ports/review-posting.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { ReviewCommentVersionConflictError } from '@change-review/domain/exceptions/review-comment-version-conflict.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { DeliveryAttempts } from '@change-review/domain/value-objects/delivery-attempts.vo';
import {
  DeliveryFailure,
  type DeliveryFailureCode,
} from '@change-review/domain/value-objects/delivery-failure.vo';
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import {
  type OnPullRequest,
  SPOTLIGHT_ACTOR,
} from '@github/application/ports/pull-request-reviews.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const AT_A_TIME = 10;

const LEASE_MS = 10 * 60 * 1000;

const MAX_SAVE_ATTEMPTS = 5;

class NoPullRequestYet extends Error {
  constructor() {
    super('The task has no pull request yet.');
  }
}

class SubjectGone extends Error {
  constructor() {
    super('The review or comment to deliver no longer exists.');
  }
}

class DeliveryFailed extends Error {
  readonly failure: DeliveryFailure;

  constructor(code: DeliveryFailureCode) {
    super(`Delivering to GitHub failed: ${code}`);
    this.failure = DeliveryFailure.of(code);
  }
}

const failureOf = (error: unknown): DeliveryFailure =>
  error instanceof DeliveryFailed || error instanceof ReviewPostingFailedError
    ? error.failure
    : DeliveryFailure.of('unexpected');

export class DeliverReviews implements ReviewDeliveryWorkPort {
  constructor(
    private readonly deliveries: ReviewDeliveriesPort,
    private readonly reviews: ReviewRepository,
    private readonly comments: ReviewCommentRepository,
    private readonly work: WorkPort,
    private readonly connections: WorkspaceConnectionsPort,
    private readonly people: PeoplePort,
    private readonly github: ReviewPostingPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    private readonly reports: ErrorReportsPort,
  ) {}

  async deliverDue(): Promise<void> {
    for (let turn = 0; turn < AT_A_TIME; turn += 1) {
      const delivered = await this.deliverNext();

      if (!delivered) {
        return;
      }
    }
  }

  private async deliverNext(): Promise<boolean> {
    const now = this.clock.now();
    const delivery = await this.deliveries.leaseDue(
      now,
      new Date(now.getTime() + LEASE_MS),
    );

    if (!delivery) {
      return false;
    }

    try {
      await this.deliver(delivery);
      await this.deliveries.delivered(delivery);
    } catch (error) {
      await this.recordFailure(delivery, error, now);
    }

    return true;
  }

  private async recordFailure(
    delivery: LeasedReviewDelivery,
    error: unknown,
    now: Date,
  ): Promise<void> {
    const attempts = DeliveryAttempts.of(delivery.attempts);

    if (error instanceof NoPullRequestYet) {
      await this.deliveries.retry(delivery, attempts.untilPullRequest(now));
      return;
    }

    const failure = error instanceof SubjectGone ? null : failureOf(error);
    const retry = failure && attempts.retryAfter(failure, now);

    if (retry && failure.recovery === 'waits-for-thread') {
      await this.deliveries.retry(delivery, retry);
      return;
    }

    this.logger.warn(
      {
        deliveryId: delivery.id,
        kind: delivery.kind,
        attempts: delivery.attempts,
        err: error,
      },
      'Delivering a review to GitHub',
    );

    if (retry) {
      await this.deliveries.retry(delivery, retry);
      return;
    }

    if (failure) {
      await this.markNotSent(delivery, failure);
    }
    await this.deliveries.failed(delivery);
    this.reports.report(error, {
      source: 'Delivering reviews to GitHub',
      workspaceId: delivery.workspaceId.value,
      taskId: delivery.taskId.value,
    });
  }

  private async markNotSent(
    delivery: LeasedReviewDelivery,
    failure: DeliveryFailure,
  ): Promise<void> {
    if (delivery.kind === 'review') {
      const review = await this.reviews.find(delivery.subject);

      if (review) {
        await this.reviews.save(review.failedToPost(failure));
      }
      return;
    }

    const id = delivery.subject;

    if (delivery.kind === 'reply' || delivery.kind === 'file') {
      await this.saveWithRetry(id, (comment) => comment.notPosted(failure));
    } else if (delivery.kind === 'edit') {
      await this.saveWithRetry(id, (comment) => comment.editNotSent());
    }
  }

  private async deliver(delivery: LeasedReviewDelivery): Promise<void> {
    const task = await this.work.task(delivery.taskId);

    if (!task) {
      throw new DeliveryFailed('task-deleted');
    }
    if (!task.pullRequest) {
      throw new NoPullRequestYet();
    }

    if (!(await this.connections.isConnected(task.workspaceId))) {
      throw new DeliveryFailed('not-connected');
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

    if (delivery.kind === 'review') {
      await this.postReview(delivery, on);
      return;
    }

    const comment = await this.comments.find(delivery.subject);

    if (!comment) {
      throw new SubjectGone();
    }
    if (!comment.deliveredAlone) {
      return;
    }

    const target = await on(comment.author);

    if (delivery.kind === 'reply') {
      await this.postReply(delivery, comment, target);
      return;
    }

    if (delivery.kind === 'file') {
      await this.postOnFile(delivery, comment, target);
      return;
    }

    if (!comment.github) {
      throw new DeliveryFailed('never-on-github');
    }

    if (delivery.kind === 'edit') {
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
    delivery: Extract<LeasedReviewDelivery, { kind: 'review' }>,
    on: (author: ReviewAuthor) => Promise<OnPullRequest>,
  ): Promise<void> {
    const review = await this.reviews.find(delivery.subject);

    if (!review) {
      throw new SubjectGone();
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

    const author = await on(review.author);
    const submitted = await this.sent(delivery, () =>
      this.github.submit({
        ...author,
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
      }),
    );

    try {
      await this.reviews.save(
        review.postedAs({
          githubId: submitted.githubId,
          verdictOnGitHub: submitted.postedAs,
          comments,
          onLinesOnGitHub: submitted.comments,
          now: this.clock.now(),
        }),
      );
    } catch (error) {
      this.logger.warn(
        { deliveryId: delivery.id, err: error },
        'Recording a review posted to GitHub',
      );
      throw new DeliveryFailed('not-recorded');
    }
  }

  private async sent<T>(
    delivery: LeasedReviewDelivery,
    post: () => Promise<T>,
  ): Promise<T> {
    if (delivery.sendingSince) {
      throw new DeliveryFailed('not-recorded');
    }

    await this.deliveries.sending(delivery, this.clock.now());

    return post();
  }

  private async postReply(
    delivery: LeasedReviewDelivery,
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
      throw new DeliveryFailed('parent-deleted');
    }
    if (parent.sending) {
      throw new DeliveryFailed('parent-not-on-github');
    }

    const thread = parent.threadOnGitHub;

    if (!thread) {
      throw new DeliveryFailed('parent-never-on-github');
    }

    const posted = await this.sent(delivery, () =>
      this.github.reply({
        ...target,
        to: thread.id,
        body: reply.sentBody ?? reply.body,
      }),
    );

    await this.saveWithRetry(reply.id, (latest) => latest.postedAs(posted));
  }

  private async postOnFile(
    delivery: LeasedReviewDelivery,
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

    const posted = await this.sent(delivery, () =>
      this.github.commentOnFile({
        ...target,
        path: comment.anchor.path.value,
        body: comment.sentBody ?? comment.body,
      }),
    );

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
          attempt >= MAX_SAVE_ATTEMPTS
        ) {
          throw new DeliveryFailed('not-recorded');
        }
      }
    }
  }
}
