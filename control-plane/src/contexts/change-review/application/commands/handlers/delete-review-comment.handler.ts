import type { DeleteReviewCommentCommand } from '@change-review/application/commands/delete-review-comment.command';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { UnknownReviewCommentError } from '@change-review/domain/exceptions/unknown-review-comment.error';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class DeleteReviewCommentHandler
  implements CommandHandlerPort<DeleteReviewCommentCommand, void>
{
  constructor(
    private readonly access: TeamWorkAccess,
    private readonly comments: ReviewCommentRepository,
  ) {}

  async execute(command: DeleteReviewCommentCommand): Promise<void> {
    try {
      const { task, by } = await this.access.actingInReview(
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

      await this.comments.save(comment.deleted(by));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
