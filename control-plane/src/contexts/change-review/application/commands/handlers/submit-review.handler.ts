import type { SubmitReviewCommand } from '@change-review/application/commands/submit-review.command';
import type { ReviewAccess } from '@change-review/application/services/review-access.service';
import { Review } from '@change-review/domain/aggregates/review.aggregate';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class SubmitReviewHandler
  implements CommandHandlerPort<SubmitReviewCommand, string>
{
  constructor(
    private readonly access: ReviewAccess,
    private readonly comments: ReviewCommentRepository,
    private readonly reviews: ReviewRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  // A draft is part of one review, so the review and the claim on its drafts commit together.
  async execute(command: SubmitReviewCommand): Promise<string> {
    try {
      const { task, author } = await this.access.ofRun(
        command.teamId,
        command.runId,
        command.viewerId,
      );

      return await this.transaction.run(async () => {
        const drafts = await this.comments.draftsBy(task.id, author);
        const { review, claimed } = Review.submit({
          id: ReviewId.of(this.ids.generate()),
          workspaceId: task.workspaceId,
          taskId: task.id,
          author,
          verdict: command.verdict,
          body: command.body,
          drafts,
          now: this.clock.now(),
        });

        for (const comment of claimed) {
          await this.comments.save(comment);
        }
        await this.reviews.add(review);

        return review.id.value;
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
