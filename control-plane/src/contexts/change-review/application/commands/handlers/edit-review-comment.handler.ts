import type { EditReviewCommentCommand } from '@change-review/application/commands/edit-review-comment.command';
import type { ReviewAccess } from '@change-review/application/services/review-access.service';
import { UnknownReviewCommentError } from '@change-review/domain/exceptions/unknown-review-comment.error';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class EditReviewCommentHandler
  implements CommandHandlerPort<EditReviewCommentCommand, void>
{
  constructor(
    private readonly access: ReviewAccess,
    private readonly comments: ReviewCommentRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: EditReviewCommentCommand): Promise<void> {
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

      await this.comments.save(
        comment.rewritten(command.body, by, this.clock.now()),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
