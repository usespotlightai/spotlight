import type { DraftReviewCommentCommand } from '@change-review/application/commands/draft-review-comment.command';
import type { ReviewAccess } from '@change-review/application/services/review-access.service';
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
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DraftReviewCommentHandler
  implements CommandHandlerPort<DraftReviewCommentCommand, string>
{
  constructor(
    private readonly access: ReviewAccess,
    private readonly comments: ReviewCommentRepository,
    private readonly transaction: TransactionPort,
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

        return await this.answer(parent, command.body, author, id, now);
      }

      const anchor =
        'file' in command.on
          ? ReviewAnchor.onFile(command.on.file)
          : ReviewAnchor.onLines(command.on);

      return await this.transaction.inTransaction(async () => {
        const thread = anchor.wholeFile
          ? await this.threadOnFile(task.id, anchor)
          : null;

        if (thread) {
          return this.answer(thread, command.body, author, id, now);
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
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async threadOnFile(
    taskId: TaskId,
    anchor: ReviewAnchor,
  ): Promise<ReviewComment | null> {
    await this.comments.lockThreadsOnFile(taskId, anchor.path);

    return fileThreadOf(
      await this.comments.threadsOnFile(taskId, anchor.path),
      anchor,
    );
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
