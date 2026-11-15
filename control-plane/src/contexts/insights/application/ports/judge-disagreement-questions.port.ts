import type { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const JUDGE_DISAGREEMENT_QUESTIONS = Symbol(
  'INSIGHTS_JUDGE_DISAGREEMENT_QUESTIONS',
);

export interface JudgeDisagreementQuestionsPort {
  ask(
    taskId: TaskId,
    disagreementId: JudgeDisagreementId,
    askedOf: UserId | null,
  ): Promise<void>;

  resolve(taskId: TaskId, disagreementId: JudgeDisagreementId): Promise<void>;
}
