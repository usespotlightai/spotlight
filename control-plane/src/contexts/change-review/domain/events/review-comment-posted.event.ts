import type { OnGitHub } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class ReviewCommentPosted implements DomainEvent {
  readonly kind = 'review.comment-posted';

  constructor(
    readonly reviewId: ReviewId,
    readonly commentId: ReviewCommentId,
    readonly github: OnGitHub | null,
  ) {}
}
