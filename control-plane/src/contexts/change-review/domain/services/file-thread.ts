import type { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';

export const fileThreadOf = (
  comments: readonly ReviewComment[],
  on: ReviewAnchor,
): ReviewComment | null =>
  comments.find(
    (comment) =>
      comment.replyTo === null &&
      comment.anchor.wholeFile &&
      comment.anchor.path.equals(on.path) &&
      comment.answerable,
  ) ?? null;
