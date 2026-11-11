import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplayCheckAttemptTakenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(attempt: number) {
    super(
      `Another check of the same change started as attempt ${attempt} at the same time. Please try again.`,
    );
    this.name = 'ReplayCheckAttemptTakenError';
  }
}
