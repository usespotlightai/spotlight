import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ExpiredPlanTermError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(expiresAt: Date) {
    super(
      `The plan ends at ${expiresAt.toISOString()}, which is not in the future. Set an end in the future, or no end.`,
    );
    this.name = 'ExpiredPlanTermError';
  }
}
