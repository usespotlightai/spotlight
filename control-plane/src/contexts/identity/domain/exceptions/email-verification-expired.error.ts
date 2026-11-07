import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class EmailVerificationExpiredError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(
      `The verification link for ${email} has expired. Please send a new one from your settings.`,
    );
    this.name = 'EmailVerificationExpiredError';
  }
}
