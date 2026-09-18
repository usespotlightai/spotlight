import type { ReviewOutboxPort } from '@change-review/application/ports/review-outbox.port';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ForgetTaskAcrossAggregates {
  constructor(
    private readonly outbox: ReviewOutboxPort,
    private readonly comments: ReviewCommentRepository,
    private readonly reviews: ReviewRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async forget(taskId: TaskId): Promise<void> {
    await this.transaction.run(async () => {
      await this.outbox.forgetTask(taskId);
      await this.comments.removeForTask(taskId);
      await this.reviews.removeForTask(taskId);
      await this.stacks.removeForTask(taskId);
    });
  }
}
