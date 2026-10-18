import type { AlertInboxRequestsPort } from '@insights/application/ports/alert-inbox-requests.port';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { InboxRequestsPort } from '@work/application/ports/inbox-requests.port';

const FORM = 'alert';

export class AlertInboxRequests implements AlertInboxRequestsPort {
  constructor(private readonly inboxRequests: InboxRequestsPort) {}

  open(taskId: TaskId, alertId: AlertId): Promise<void> {
    return this.inboxRequests.reopen({
      taskId,
      form: FORM,
      about: alertId.value,
    });
  }

  resolve(taskId: TaskId, alertId: AlertId): Promise<void> {
    return this.inboxRequests.resolve({
      taskId,
      form: FORM,
      about: alertId.value,
    });
  }
}
