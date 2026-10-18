import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ReadInboxRequestCommand } from '@work/application/commands/read-inbox-request.command';
import type { InboxRequestLoader } from '@work/application/services/inbox-request-loader.service';
import { InboxRequestVersionConflictError } from '@work/domain/exceptions/inbox-request-version-conflict.error';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';

export class ReadInboxRequestHandler
  implements CommandHandlerPort<ReadInboxRequestCommand, void>
{
  constructor(
    private readonly loader: InboxRequestLoader,
    private readonly inboxRequests: InboxRequestRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReadInboxRequestCommand): Promise<void> {
    try {
      await this.readOnce(command).catch((error: unknown) => {
        if (error instanceof InboxRequestVersionConflictError) {
          return this.readOnce(command);
        }
        throw error;
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async readOnce(command: ReadInboxRequestCommand): Promise<void> {
    const inboxRequest = await this.loader.putTo(
      command.inboxRequestId,
      command.readBy,
    );
    const viewer = UserId.of(command.readBy);

    if (inboxRequest.unreadBy(viewer)) {
      await this.inboxRequests.save(
        inboxRequest.readBy(viewer, this.clock.now()),
      );
    }
  }
}
