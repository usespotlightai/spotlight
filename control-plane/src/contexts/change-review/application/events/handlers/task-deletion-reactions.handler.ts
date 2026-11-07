import type { ReviewDeliveriesPort } from '@change-review/application/ports/review-deliveries.port';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class TaskDeletionReactions {
  constructor(
    private readonly deliveries: ReviewDeliveriesPort,
    private readonly reviews: ReviewRepository,
    private readonly comments: ReviewCommentRepository,
    private readonly checks: StackCheckRepository,
    private readonly answers: QuestionAnswerRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly sets: DecisionSetRepository,
    private readonly clock: ClockPort,
  ) {}

  async dropDeliveries(taskId: TaskId): Promise<void> {
    await this.deliveries.dropTask(taskId);
  }

  async removeReviews(taskId: TaskId): Promise<void> {
    for (const review of await this.reviews.ofTask(taskId)) {
      await this.reviews.remove(review);
    }
  }

  async removeComments(taskId: TaskId): Promise<void> {
    for (const comment of await this.comments.ofTask(taskId)) {
      await this.comments.remove(comment);
    }
  }

  async removeChecks(taskId: TaskId): Promise<void> {
    const now = this.clock.now();

    for (const check of await this.checks.ofTask(taskId)) {
      await this.checks.remove(check.delete(now));
    }
  }

  async removeAnswers(taskId: TaskId): Promise<void> {
    for (const answer of await this.answers.ofTask(taskId)) {
      await this.answers.remove(answer);
    }
  }

  async removeStacks(taskId: TaskId): Promise<void> {
    for (const stack of await this.stacks.ofTask(taskId)) {
      await this.stacks.remove(stack);
    }
  }

  async removeDecisions(taskId: TaskId): Promise<void> {
    const set = await this.sets.forTask(taskId);

    if (set) {
      await this.sets.remove(set);
    }
  }
}
