import type { AlertAsidesPort } from '@outcomes/application/ports/alert-asides.port';
import type { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskAsidesPort } from '@work/application/ports/task-asides.port';

const FORM = 'alert';

export class AlertAsides implements AlertAsidesPort {
  constructor(private readonly asides: TaskAsidesPort) {}

  open(taskId: TaskId, alertId: AlertId): Promise<void> {
    return this.asides.reopen({ taskId, form: FORM, about: alertId.value });
  }

  resolve(taskId: TaskId, alertId: AlertId): Promise<void> {
    return this.asides.resolve({ taskId, form: FORM, about: alertId.value });
  }
}
