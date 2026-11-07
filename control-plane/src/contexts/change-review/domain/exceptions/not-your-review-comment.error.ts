import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotYourReviewCommentError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor() {
    super('Only the author can change a review comment.');
    this.name = 'NotYourReviewCommentError';
  }
}
