import type { JudgeDisagreementQuestionsPort } from '@insights/application/ports/judge-disagreement-questions.port';
import type { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { InboxRequestsPort } from '@work/application/ports/inbox-requests.port';

const FORM = 'judge-disagreement';

export class JudgeDisagreementQuestions implements JudgeDisagreementQuestionsPort {
  constructor(private readonly inboxRequests: InboxRequestsPort) {}

  ask(
    taskId: TaskId,
    disagreementId: JudgeDisagreementId,
    askedOf: UserId | null,
  ): Promise<void> {
    return this.inboxRequests.create({
      taskId,
      form: FORM,
      about: disagreementId.value,
      askedOf: askedOf?.value ?? null,
    });
  }

  resolve(taskId: TaskId, disagreementId: JudgeDisagreementId): Promise<void> {
    return this.inboxRequests.resolve({
      taskId,
      form: FORM,
      about: disagreementId.value,
    });
  }
}
