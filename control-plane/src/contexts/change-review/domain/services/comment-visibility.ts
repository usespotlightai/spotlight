import type { ReviewCommentState } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const commentVisibleTo = (
  comment: {
    readonly state: ReviewCommentState;
    readonly author: ReviewAuthor;
  },
  viewer: UserId,
): boolean =>
  comment.state !== 'deleted' &&
  (comment.state !== 'draft' ||
    (comment.author.userId?.equals(viewer) ?? false));
