import type { ReceivedReviewComment } from '@change-review/application/contracts/received-review-comment.contract';
import type { WorkPort } from '@change-review/application/ports/work.port';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export class ReceiveReviewComment {
  constructor(
    private readonly work: WorkPort,
    private readonly comments: ReviewCommentRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async receive(received: ReceivedReviewComment): Promise<void> {
    const { workspaceId, comment } = received;

    await this.transaction.run(async () => {
      const known = await this.comments.onGitHub(workspaceId, comment.id);

      if (received.action === 'edited') {
        if (known) {
          await this.comments.save(
            known.editedOnGitHub(comment.body, this.clock.now()),
          );
        }
        return;
      }

      if (received.action === 'deleted') {
        if (known) {
          await this.comments.save(known.deletedOnGitHub());
        }
        return;
      }

      if (!known) {
        await this.arrived(received);
      }
    });
  }

  private async arrived({
    workspaceId,
    pullRequest,
    comment,
  }: ReceivedReviewComment): Promise<void> {
    if (!comment.line) {
      return;
    }

    const task = await this.work.taskWithPullRequest(
      workspaceId,
      PullRequestUrl.of(pullRequest),
    );

    if (!task) {
      return;
    }

    const anchor = ReviewAnchor.of({
      path: comment.path,
      side: comment.side,
      line: comment.line,
      startLine: comment.startLine,
    });
    const siblings = await this.comments.ofTask(task.id);

    if (siblings.some((each) => each.echoes(anchor, comment.body))) {
      return;
    }

    const parent =
      comment.answers === null
        ? null
        : await this.comments.onGitHub(workspaceId, comment.answers);

    await this.comments.add(
      ReviewComment.arrived({
        id: ReviewCommentId.of(this.ids.generate()),
        workspaceId,
        taskId: task.id,
        anchor,
        body: comment.body,
        author: ReviewAuthor.onGitHub(comment.login),
        replyTo: parent ? (parent.replyTo ?? parent.id) : null,
        github: { id: comment.id, url: comment.url },
        at: comment.writtenAt ?? this.clock.now(),
      }),
    );
  }
}
