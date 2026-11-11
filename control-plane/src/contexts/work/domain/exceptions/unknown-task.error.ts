import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownTaskError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(taskId: string) {
    super(`Task ${taskId} not found.`);
    this.name = 'UnknownTaskError';
  }
}
