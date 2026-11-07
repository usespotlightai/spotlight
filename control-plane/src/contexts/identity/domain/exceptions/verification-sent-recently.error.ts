import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class VerificationSentRecentlyError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(
      `A verification link was sent to ${email} less than a minute ago. Please wait, then try again.`,
    );
    this.name = 'VerificationSentRecentlyError';
  }
}
