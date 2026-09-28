import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReviewPosted implements DomainEvent {
  readonly kind = 'review.posted';

  constructor(
    readonly reviewId: ReviewId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId,
    readonly onFiles: readonly ReviewCommentId[],
  ) {}
}
