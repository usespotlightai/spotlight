import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class ReviewNotPosted implements DomainEvent {
  readonly kind = 'review.not-posted';

  constructor(
    readonly reviewId: ReviewId,
    readonly comments: readonly ReviewCommentId[],
    readonly outcome: 'failed' | 'withdrawn',
  ) {}
}
