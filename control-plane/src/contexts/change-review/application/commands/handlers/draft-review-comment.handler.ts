import type { DraftReviewCommentCommand } from '@change-review/application/commands/draft-review-comment.command';
import type { ReviewAccess } from '@change-review/application/services/review-access.service';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { UnknownReviewCommentError } from '@change-review/domain/exceptions/unknown-review-comment.error';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

export class DraftReviewCommentHandler
  implements CommandHandlerPort<DraftReviewCommentCommand, string>
{
  constructor(
    private readonly access: ReviewAccess,
    private readonly comments: ReviewCommentRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DraftReviewCommentCommand): Promise<string> {
    try {
      const { task, author } = await this.access.ofRun(
        command.teamId,
        command.runId,
        command.viewerId,
      );
      const id = ReviewCommentId.of(this.ids.generate());
      const now = this.clock.now();

      if ('replyTo' in command.on) {
        const parent = await this.comments.find(
          ReviewCommentId.of(command.on.replyTo),
        );

        if (!parent?.taskId.equals(task.id)) {
          throw new UnknownReviewCommentError();
        }

        const reply = parent.replied({ id, body: command.body, author, now });

        await this.comments.add(reply);

        return reply.id.value;
      }

      const draft = ReviewComment.drafted({
        id,
        workspaceId: task.workspaceId,
        taskId: task.id,
        anchor: ReviewAnchor.of(command.on),
        body: command.body,
        author,
        now,
      });

      await this.comments.add(draft);

      return draft.id.value;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
