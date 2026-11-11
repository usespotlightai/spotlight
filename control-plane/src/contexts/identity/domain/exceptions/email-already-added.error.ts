import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class EmailAlreadyAddedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(`${email} was just added. Please reload and try again.`);
    this.name = 'EmailAlreadyAddedError';
  }
}
