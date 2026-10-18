import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const ALERT_INBOX_REQUESTS = Symbol('INSIGHTS_ALERT_INBOX_REQUESTS');

export interface AlertInboxRequestsPort {
  open(taskId: TaskId, alertId: AlertId): Promise<void>;

  resolve(taskId: TaskId, alertId: AlertId): Promise<void>;
}
