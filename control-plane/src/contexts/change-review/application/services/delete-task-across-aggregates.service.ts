import type { ReviewOutboxPort } from '@change-review/application/ports/review-outbox.port';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DeleteTaskAcrossAggregates {
  constructor(
    private readonly outbox: ReviewOutboxPort,
    private readonly comments: ReviewCommentRepository,
    private readonly reviews: ReviewRepository,
    private readonly checks: StackCheckRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly decisions: DecisionSetRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async deleteTask(taskId: TaskId): Promise<void> {
    await this.transaction.inTransaction(async () => {
      await this.outbox.deleteTask(taskId);
      await this.comments.removeForTask(taskId);
      await this.reviews.removeForTask(taskId);
      const now = this.clock.now();
      for (const check of await this.checks.ofTask(taskId)) {
        await this.checks.remove(check.delete(now));
      }
      await this.stacks.removeForTask(taskId);
      await this.decisions.removeForTask(taskId);
    });
  }
}
