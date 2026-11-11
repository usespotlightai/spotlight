import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class EmailInUseError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(`${email} belongs to another Spotlight account.`);
    this.name = 'EmailInUseError';
  }
}
