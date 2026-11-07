import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TooManyEmailsError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(most: number) {
    super(
      `You have ${most} additional emails, the most allowed. Please remove one first.`,
    );
    this.name = 'TooManyEmailsError';
  }
}
