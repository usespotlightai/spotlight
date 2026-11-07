import type { ReviewCommentsPort } from '@github/application/ports/review-comments.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { ReplyToReviewCommentCommand } from '@work/application/commands/reply-to-review-comment.command';
import { RunWorksNoTaskError } from '@work/application/errors/run-works-no-task.error';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunLoader } from '@work/application/services/run-loader.service';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ReviewCommentHandle } from '@work/domain/value-objects/review-comment-handle.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export class ReplyToReviewCommentHandler
  implements CommandHandlerPort<ReplyToReviewCommentCommand, void>
{
  constructor(
    private readonly runs: RunLoader,
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly reviewComments: ReviewCommentsPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReplyToReviewCommentCommand): Promise<void> {
    try {
      const { run, worked } = await this.runs.actingBeyondItself(
        command.runId,
        command.runnerId,
        'reply to a review comment',
      );

      if (!worked) {
        throw new RunWorksNoTaskError('reply to a review comment');
      }

      const { task } = worked;
      const at = ReviewCommentHandle.of(command.handle);
      const toReply = task.reviewCommentToReplyFrom(run.runId, worked.at, at);
      const line = await this.lines.findByStation(task.stationId);
      // Post to the host before you record the reply. Then the trail never has a reply that the pull request does not have.
      await this.reviewComments.reply({
        workspaceId: task.workspaceId,
        repository: toReply.repository,
        pullRequest: toReply.pullRequest,
        reviewComment: toReply.reviewComment.value,
        body: command.body,
        resolve: command.resolve,
      });

      await this.tasks.save(
        task.recordReviewCommentReply(run.runId, worked.at, at, {
          line,
          body: TaskNoteBody.of(command.body),
          at: this.clock.now(),
          voice: Voice.station(run.runId),
        }),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
