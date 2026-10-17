import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { Review } from '@change-review/domain/aggregates/review.aggregate';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type {
  LeftComment,
  PullRequestReviewingPort,
  ReviewingRun,
  SubmittedVerdict,
} from '@work/application/ports/pull-request-reviewing.port';

export class AgentReviews implements PullRequestReviewingPort {
  constructor(
    private readonly work: WorkPort,
    private readonly comments: ReviewCommentRepository,
    private readonly reviews: ReviewRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async comment(on: ReviewingRun, left: LeftComment): Promise<string> {
    const task = await this.reviewed(on);
    const draft = ReviewComment.draft({
      id: ReviewCommentId.of(this.ids.generate()),
      workspaceId: task.workspaceId,
      taskId: task.id,
      anchor: ReviewAnchor.onLines({
        path: left.path,
        side: left.side,
        line: left.line,
        startLine: left.startLine,
      }),
      body: left.body,
      author: ReviewAuthor.agent(on.runId),
      now: this.clock.now(),
    });

    await this.comments.add(draft);

    return draft.id.value;
  }

  // A draft is part of one review, so the review and the claim on its drafts commit together.
  async submit(on: ReviewingRun, verdict: SubmittedVerdict): Promise<string> {
    const task = await this.reviewed(on);
    const author = ReviewAuthor.agent(on.runId);

    return this.transaction.inTransaction(async () => {
      const { review, claimed } = Review.submit({
        id: ReviewId.of(this.ids.generate()),
        workspaceId: task.workspaceId,
        taskId: task.id,
        author,
        verdict: verdict.verdict,
        body: verdict.body,
        drafts: await this.comments.draftsBy(task.id, author),
        now: this.clock.now(),
      });

      for (const comment of claimed) {
        await this.comments.save(comment);
      }
      await this.reviews.add(review);

      return review.id.value;
    });
  }

  private async reviewed(on: ReviewingRun): Promise<ReviewedTask> {
    const task = await this.work.task(on.taskId);

    if (!task?.pullRequest || !task.reviewing) {
      throw new InvalidReviewError(
        'is left by an agent only on a pull request its task reviews',
      );
    }

    return task;
  }
}
