import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { ReopenInboxRequestCommand } from '@work/application/commands/reopen-inbox-request.command';
import type { InboxRequestLoader } from '@work/application/services/inbox-request-loader.service';
import { InboxRequestVersionConflictError } from '@work/domain/exceptions/inbox-request-version-conflict.error';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';

export class ReopenInboxRequestHandler
  implements CommandHandlerPort<ReopenInboxRequestCommand, void>
{
  constructor(
    private readonly loader: InboxRequestLoader,
    private readonly inboxRequests: InboxRequestRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReopenInboxRequestCommand): Promise<void> {
    try {
      await this.reopenOnce(command).catch((error: unknown) => {
        if (error instanceof InboxRequestVersionConflictError) {
          return this.reopenOnce(command);
        }
        throw error;
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async reopenOnce(command: ReopenInboxRequestCommand): Promise<void> {
    const inboxRequest = await this.loader.putTo(
      command.inboxRequestId,
      command.reopenedBy,
    );
    const reopened = inboxRequest.reopen(this.clock.now());

    if (reopened !== inboxRequest) {
      await this.inboxRequests.save(reopened);
    }
  }
}
