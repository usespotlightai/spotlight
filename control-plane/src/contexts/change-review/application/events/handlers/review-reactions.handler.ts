import type {
  ReviewOutboxPort,
  ReviewSyncKind,
} from '@change-review/application/ports/review-outbox.port';
import type { ReviewCommentNotPosted } from '@change-review/domain/events/review-comment-not-posted.event';
import type { ReviewCommentPlaced } from '@change-review/domain/events/review-comment-placed.event';
import type { ReviewCommentRemoved } from '@change-review/domain/events/review-comment-removed.event';
import type { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import type { ReviewCommentRewritten } from '@change-review/domain/events/review-comment-rewritten.event';
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
    private readonly outbox: ReviewOutboxPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async onSubmitted(event: ReviewSubmitted): Promise<void> {
    await this.sync(event, 'review', event.reviewId.value);
  }

  async onPosted(event: ReviewPosted): Promise<void> {
    for (const commentId of event.onFiles) {
      await this.sync(event, 'file', commentId.value);
    }
  }

  async onCommentPlaced(event: ReviewCommentPlaced): Promise<void> {
    const comment = await this.comments.find(event.commentId);

    if (comment?.belongsTo(event.reviewId)) {
      await this.comments.save(comment.postedAs(event.github));
    }
  }

  async onCommentNotPosted(event: ReviewCommentNotPosted): Promise<void> {
    const comment = await this.comments.find(event.commentId);

    if (comment?.belongsTo(event.reviewId)) {
      await this.comments.save(comment.notPosted());
    }
  }

  async onReplied(event: ReviewCommentReplied): Promise<void> {
    await this.sync(event, 'reply', event.commentId.value);
  }

  async onRewritten(event: ReviewCommentRewritten): Promise<void> {
    if (event.onGitHub) {
      await this.sync(event, 'edit', event.commentId.value);
    }
  }

  async onRemoved(event: ReviewCommentRemoved): Promise<void> {
    if (event.onGitHub) {
      await this.sync(event, 'delete', event.commentId.value);
    }
  }

  private async sync(
    on: { readonly workspaceId: WorkspaceId; readonly taskId: TaskId },
    kind: ReviewSyncKind,
    subjectId: string,
  ): Promise<void> {
    await this.outbox.enqueue(
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
