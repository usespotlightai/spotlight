import type { ReviewsPort } from '@memory/application/ports/reviews.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { InboxRequestsPort } from '@work/application/ports/inbox-requests.port';

const FORM = 'memories';

export class Reviews implements ReviewsPort {
  constructor(private readonly inboxRequests: InboxRequestsPort) {}

  create(taskId: TaskId, runId: RunId): Promise<void> {
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

  reviewItemOf(taskId: TaskId, runId: RunId): Promise<string | null> {
    return this.inboxRequests.idOf({ taskId, form: FORM, about: runId.value });
  }
}
