import type {
  ReviewDeliveriesPort,
  ReviewDeliverySubject,
} from '@change-review/application/ports/review-deliveries.port';
import type { IncludedCommentPosted } from '@change-review/domain/events/included-comment-posted.event';
import type { IncludedCommentReturned } from '@change-review/domain/events/included-comment-returned.event';
import type { ReviewCommentDeleted } from '@change-review/domain/events/review-comment-deleted.event';
import type { ReviewCommentEdited } from '@change-review/domain/events/review-comment-edited.event';
import type { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import type { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import type { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { ReviewDeliveryId } from '@change-review/domain/value-objects/review-delivery-id.vo';
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
    await this.deliver(event, { kind: 'review', subject: event.reviewId });
  }

  async onPosted(event: ReviewPosted): Promise<void> {
    for (const commentId of event.onFiles) {
      await this.deliver(event, { kind: 'file', subject: commentId });
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
    await this.deliver(event, { kind: 'reply', subject: event.commentId });
  }

  async onEdited(event: ReviewCommentEdited): Promise<void> {
    if (event.onGitHub) {
      await this.deliver(event, { kind: 'edit', subject: event.commentId });
    }
  }

  async onDeleted(event: ReviewCommentDeleted): Promise<void> {
    if (event.onGitHub) {
      await this.deliver(event, {
        kind: 'delete',
        subject: event.commentId,
      });
    }
  }

  private async deliver(
    on: { readonly workspaceId: WorkspaceId; readonly taskId: TaskId },
    subject: ReviewDeliverySubject,
  ): Promise<void> {
    await this.deliveries.enqueue(
      {
        id: ReviewDeliveryId.of(this.ids.generate()),
        workspaceId: on.workspaceId,
        taskId: on.taskId,
        ...subject,
      },
      this.clock.now(),
    );
  }
}
