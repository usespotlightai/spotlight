import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TooManyVerificationsSentError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(most: number) {
    super(
      `Spotlight sent ${most} verification links for your account in the last hour, the most allowed. Please wait, then try again.`,
    );
    this.name = 'TooManyVerificationsSentError';
  }
}
