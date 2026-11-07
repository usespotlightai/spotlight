import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InviteeCountError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(most: number, count: number) {
    super(`Number of email addresses must be 1 to ${most}. Received: ${count}`);
    this.name = 'InviteeCountError';
  }
}
