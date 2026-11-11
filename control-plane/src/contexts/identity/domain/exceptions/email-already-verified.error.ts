import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class EmailAlreadyVerifiedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(`${email} is already verified.`);
    this.name = 'EmailAlreadyVerifiedError';
  }
}
