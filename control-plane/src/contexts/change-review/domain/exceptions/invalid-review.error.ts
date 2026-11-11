import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidReviewError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`A review ${reason}.`);
    this.name = 'InvalidReviewError';
  }
}
