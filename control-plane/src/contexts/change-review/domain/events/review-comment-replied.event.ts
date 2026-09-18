import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReviewCommentReplied implements DomainEvent {
  readonly kind = 'review-comment.replied';

  constructor(
    readonly commentId: ReviewCommentId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId,
  ) {}
}
