import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TaskNotReopenableError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Task ${taskId} is not finished, or it is completed. A word cannot reopen it.`,
    );
    this.name = 'TaskNotReopenableError';
  }
}
