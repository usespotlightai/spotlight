import { Review } from '@change-review/domain/aggregates/review.aggregate';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReviewSubmission {
  readonly task: { readonly id: TaskId; readonly workspaceId: WorkspaceId };
  readonly author: ReviewAuthor;
  readonly verdict: string;
  readonly body: string;
}

export class SubmitReview {
  constructor(
    private readonly comments: ReviewCommentRepository,
    private readonly reviews: ReviewRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  // A draft is part of one review, so the review and the claim on its drafts commit together.
  submit(submission: ReviewSubmission): Promise<ReviewId> {
    return this.transaction.inTransaction(async () => {
      const { review, claimed } = Review.submit({
        id: ReviewId.of(this.ids.generate()),
        workspaceId: submission.task.workspaceId,
        taskId: submission.task.id,
        author: submission.author,
        verdict: submission.verdict,
        body: submission.body,
        drafts: await this.comments.draftsOn(submission.task.id),
        now: this.clock.now(),
      });

      await this.reviews.add(review);
      for (const comment of claimed) {
        await this.comments.save(comment);
      }

      return review.id;
    });
  }
}
