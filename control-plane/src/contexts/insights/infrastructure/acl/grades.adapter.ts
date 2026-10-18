import type { GradesPort } from '@insights/application/ports/grades.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { InboxRequestsPort } from '@work/application/ports/inbox-requests.port';

const FORM = 'grade';

export class Grades implements GradesPort {
  constructor(private readonly inboxRequests: InboxRequestsPort) {}

  ask(taskId: TaskId, runId: RunId): Promise<void> {
    return this.inboxRequests.create({
      taskId,
      form: FORM,
      about: runId.value,
    });
  }

  resolve(taskId: TaskId, runId: RunId): Promise<void> {
    return this.inboxRequests.resolve({
      taskId,
      form: FORM,
      about: runId.value,
    });
  }
}
