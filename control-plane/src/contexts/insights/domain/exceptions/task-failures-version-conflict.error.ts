import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TaskFailuresVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Failures of task ${taskId} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'TaskFailuresVersionConflictError';
  }
}
