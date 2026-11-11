import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReopenedByNobodyError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(`Task ${taskId} can be reopened only by a person.`);
    this.name = 'ReopenedByNobodyError';
  }
}
