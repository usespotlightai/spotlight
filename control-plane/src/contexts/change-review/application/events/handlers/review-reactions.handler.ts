import type {
  ReviewDeliveriesPort,
  ReviewDeliveryKind,
} from '@change-review/application/ports/review-deliveries.port';
import type { IncludedCommentPosted } from '@change-review/domain/events/included-comment-posted.event';
import type { IncludedCommentReturned } from '@change-review/domain/events/included-comment-returned.event';
import type { ReviewCommentDeleted } from '@change-review/domain/events/review-comment-deleted.event';
import type { ReviewCommentEdited } from '@change-review/domain/events/review-comment-edited.event';
import type { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import type { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import type { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReviewReactions {
  constructor(
    private readonly comments: ReviewCommentRepository,
    private readonly deliveries: ReviewDeliveriesPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async onSubmitted(event: ReviewSubmitted): Promise<void> {
    await this.deliver(event, 'review', event.reviewId.value);
  }

  async onPosted(event: ReviewPosted): Promise<void> {
    for (const commentId of event.onFiles) {
      await this.deliver(event, 'file', commentId.value);
    }
  }

  async onCommentPosted(event: IncludedCommentPosted): Promise<void> {
    const comment = await this.comments.find(event.commentId);

    if (comment?.belongsTo(event.reviewId)) {
      await this.comments.save(comment.postedAs(event.github));
    }
  }

  async onCommentReturned(event: IncludedCommentReturned): Promise<void> {
    const comment = await this.comments.find(event.commentId);

    if (comment?.belongsTo(event.reviewId)) {
      await this.comments.save(comment.returnedToDraftFrom(event.reviewId));
    }
  }

  async onReplied(event: ReviewCommentReplied): Promise<void> {
    await this.deliver(event, 'reply', event.commentId.value);
  }

  async onEdited(event: ReviewCommentEdited): Promise<void> {
    if (event.onGitHub) {
      await this.deliver(event, 'edit', event.commentId.value);
    }
  }

  async onDeleted(event: ReviewCommentDeleted): Promise<void> {
    if (event.onGitHub) {
      await this.deliver(event, 'delete', event.commentId.value);
    }
  }

  private async deliver(
    on: { readonly workspaceId: WorkspaceId; readonly taskId: TaskId },
    kind: ReviewDeliveryKind,
    subjectId: string,
  ): Promise<void> {
    await this.deliveries.enqueue(
      {
        id: this.ids.generate(),
        workspaceId: on.workspaceId,
        taskId: on.taskId,
        kind,
        subjectId,
      },
      this.clock.now(),
    );
  }
}
