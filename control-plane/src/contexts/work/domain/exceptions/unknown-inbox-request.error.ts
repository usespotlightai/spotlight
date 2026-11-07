import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownInboxRequestError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(id: string) {
    super(`Inbox request ${id} not found.`);
    this.name = 'UnknownInboxRequestError';
  }
}
