import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotYourEmailError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(email: string) {
    super(
      `${email} was added by another account. Please sign in as that account to verify it.`,
    );
    this.name = 'NotYourEmailError';
  }
}
