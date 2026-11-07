import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidReviewPolicyError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Review policy ${reason}.`);
    this.name = 'InvalidReviewPolicyError';
  }
}
