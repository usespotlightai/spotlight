import type { SubmitReviewCommand } from '@change-review/application/commands/submit-review.command';
import type { SubmitReview } from '@change-review/application/services/submit-review.service';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class SubmitReviewHandler
  implements CommandHandlerPort<SubmitReviewCommand, string>
{
  constructor(
    private readonly access: TeamWorkAccess,
    private readonly submitting: SubmitReview,
  ) {}

  async execute(command: SubmitReviewCommand): Promise<string> {
    try {
      const { task, author } = await this.access.actingInReview(
        command.teamId,
        command.runId,
        command.viewerId,
      );

      return (
        await this.submitting.submit({
          task,
          author,
          verdict: command.verdict,
          body: command.body,
        })
      ).value;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
