import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidReviewRequestError extends DomainError {
  readonly kind = 'internal' as const;

  constructor(reason: string) {
    super(`Review request ${reason}.`);
    this.name = 'InvalidReviewRequestError';
  }
}
