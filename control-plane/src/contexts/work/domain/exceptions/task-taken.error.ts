import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TaskTakenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(`Task ${taskId} is assigned to another person.`);
    this.name = 'TaskTakenError';
  }
}
