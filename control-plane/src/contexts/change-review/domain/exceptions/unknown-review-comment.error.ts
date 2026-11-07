import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownReviewCommentError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor() {
    super('Review comment not found.');
    this.name = 'UnknownReviewCommentError';
  }
}
