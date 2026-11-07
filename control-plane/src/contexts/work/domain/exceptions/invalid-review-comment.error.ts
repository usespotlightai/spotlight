import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidReviewCommentError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Review comment ${reason}.`);
    this.name = 'InvalidReviewCommentError';
  }
}
