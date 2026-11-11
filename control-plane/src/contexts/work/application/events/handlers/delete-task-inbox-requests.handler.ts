import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';

export class DeleteTaskInboxRequests {
  constructor(private readonly inboxRequests: InboxRequestRepository) {}

  async on(event: TaskDeleted): Promise<void> {
    for (const request of await this.inboxRequests.ofTask(event.taskId)) {
      await this.inboxRequests.remove(request);
    }
  }
}
