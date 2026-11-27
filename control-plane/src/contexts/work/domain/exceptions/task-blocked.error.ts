import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class TaskBlockedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: TaskId, reason: string) {
    super(`Task ${taskId.value} ${reason}`);
    this.name = 'TaskBlockedError';
  }
}
