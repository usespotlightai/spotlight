import type { DraftReviewCommentCommand } from '@change-review/application/commands/draft-review-comment.command';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { UnknownReviewCommentError } from '@change-review/domain/exceptions/unknown-review-comment.error';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { fileThreadOf } from '@change-review/domain/services/file-thread';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

export class DraftReviewCommentHandler
  implements CommandHandlerPort<DraftReviewCommentCommand, string>
{
  constructor(
    private readonly access: TeamWorkAccess,
    private readonly comments: ReviewCommentRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DraftReviewCommentCommand): Promise<string> {
    try {
      const { task, author } = await this.access.actingInReview(
        command.teamId,
        command.runId,
        command.viewerId,
      );
      const id = ReviewCommentId.of(this.ids.generate());
      const now = this.clock.now();

      if (command.on.replyTo) {
        const parent = await this.comments.find(
          ReviewCommentId.of(command.on.replyTo),
        );

        if (!parent?.taskId.equals(task.id)) {
          throw new UnknownReviewCommentError();
        }

        return await this.answer(parent, command.body, author, id, now);
      }

      const anchor = ReviewAnchor.at(command.on);
      const thread = anchor.wholeFile
        ? fileThreadOf(await this.comments.onFile(task.id, anchor.path), anchor)
        : null;

      if (thread) {
        return await this.answer(thread, command.body, author, id, now);
      }

      const draft = ReviewComment.draft({
        id,
        workspaceId: task.workspaceId,
        taskId: task.id,
        anchor,
        body: command.body,
        author,
        now,
      });

      await this.comments.add(draft);

      return draft.id.value;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async answer(
    parent: ReviewComment,
    body: string,
    author: ReviewAuthor,
    id: ReviewCommentId,
    now: Date,
  ): Promise<string> {
    const reply = parent.replied({ id, body, author, now });

    await this.comments.add(reply);

    return reply.id.value;
  }
}
