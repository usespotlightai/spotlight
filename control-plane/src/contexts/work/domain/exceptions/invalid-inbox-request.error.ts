import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidInboxRequestError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Inbox request ${reason}.`);
    this.name = 'InvalidInboxRequestError';
  }
}
