import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TaskChangeShapeVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Change shape of task ${taskId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TaskChangeShapeVersionConflictError';
  }
}
