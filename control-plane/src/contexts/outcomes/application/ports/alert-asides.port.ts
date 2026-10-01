import type { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const ALERT_ASIDES = Symbol('OUTCOMES_ALERT_ASIDES');

export interface AlertAsidesPort {
  open(taskId: TaskId, alertId: AlertId): Promise<void>;

  settle(taskId: TaskId, alertId: AlertId): Promise<void>;
}
