import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { ResolveInboxRequestCommand } from '@work/application/commands/resolve-inbox-request.command';
import type { InboxRequestLoader } from '@work/application/services/inbox-request-loader.service';
import { InboxRequestVersionConflictError } from '@work/domain/exceptions/inbox-request-version-conflict.error';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';

export class ResolveInboxRequestHandler
  implements CommandHandlerPort<ResolveInboxRequestCommand, void>
{
  constructor(
    private readonly loader: InboxRequestLoader,
    private readonly inboxRequests: InboxRequestRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ResolveInboxRequestCommand): Promise<void> {
    try {
      await this.resolveOnce(command).catch((error: unknown) => {
        if (error instanceof InboxRequestVersionConflictError) {
          return this.resolveOnce(command);
        }
        throw error;
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async resolveOnce(
    command: ResolveInboxRequestCommand,
  ): Promise<void> {
    const inboxRequest = await this.loader.putTo(
      command.inboxRequestId,
      command.resolvedBy,
    );
    const resolved = inboxRequest.resolve(this.clock.now());

    if (resolved !== inboxRequest) {
      await this.inboxRequests.save(resolved);
    }
  }
}
