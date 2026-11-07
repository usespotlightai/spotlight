import type { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { QuestionId } from '@change-review/domain/value-objects/stack-ids';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface QuestionAnswerRepository {
  add(answer: QuestionAnswer): Promise<void>;

  save(answer: QuestionAnswer): Promise<void>;

  of(
    stackId: ChangeStackId,
    questionId: QuestionId,
    personId: UserId,
  ): Promise<QuestionAnswer | null>;

  ofTask(taskId: TaskId): Promise<readonly QuestionAnswer[]>;

  remove(answer: QuestionAnswer): Promise<void>;
}
