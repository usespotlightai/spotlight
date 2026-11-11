import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InboxRequestAlreadyOpenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(taskId: string, form: string) {
    super(`Task ${taskId} already has an open ${form} request.`);
    this.name = 'InboxRequestAlreadyOpenError';
  }
}
