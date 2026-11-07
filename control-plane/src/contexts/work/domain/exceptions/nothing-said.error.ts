import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NothingSaidError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(`Task ${taskId} cannot be reopened with nothing said.`);
    this.name = 'NothingSaidError';
  }
}
