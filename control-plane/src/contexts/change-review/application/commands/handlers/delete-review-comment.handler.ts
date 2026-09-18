import type { DeleteReviewCommentCommand } from '@change-review/application/commands/delete-review-comment.command';
import type { ReviewAccess } from '@change-review/application/services/review-access.service';
import { UnknownReviewCommentError } from '@change-review/domain/exceptions/unknown-review-comment.error';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class DeleteReviewCommentHandler
  implements CommandHandlerPort<DeleteReviewCommentCommand, void>
{
  constructor(
    private readonly access: ReviewAccess,
    private readonly comments: ReviewCommentRepository,
  ) {}

  async execute(command: DeleteReviewCommentCommand): Promise<void> {
    try {
      const { task, by } = await this.access.ofRun(
        command.teamId,
        command.runId,
        command.viewerId,
      );
      const comment = await this.comments.find(
        ReviewCommentId.of(command.commentId),
      );

      if (!comment?.taskId.equals(task.id)) {
        throw new UnknownReviewCommentError();
      }

      await this.comments.save(comment.removed(by));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
