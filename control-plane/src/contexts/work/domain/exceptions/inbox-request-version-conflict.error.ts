import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InboxRequestVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Inbox request ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'InboxRequestVersionConflictError';
  }
}
