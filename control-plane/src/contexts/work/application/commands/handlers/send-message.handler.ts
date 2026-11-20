import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { SendMessageCommand } from '@work/application/commands/send-message.command';
import type { DraftSending } from '@work/application/services/draft-sending.service';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { MessageSending } from '@work/application/services/message-sending.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';

export class SendMessageHandler implements CommandHandlerPort<
  SendMessageCommand,
  void
> {
  constructor(
    private readonly dispatches: DispatchRepository,
    private readonly transaction: TransactionPort,
    private readonly files: FilesLoader,
    private readonly drafts: DraftSending,
    private readonly sending: MessageSending,
  ) {}

  async execute(command: SendMessageCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);
      const dispatch = await this.dispatches.find(runId);
      const subject = dispatch?.subject;

      if (!dispatch || subject?.kind !== 'task') {
        throw new UnknownTaskError(command.runId);
      }

      const { taskId, stationId } = subject;
      const attachments = await this.files.handedOver(
        dispatch.workspaceId,
        command.attachments,
      );

      const next = await this.transaction.inTransaction(() =>
        this.sending.send(
          {
            sentBy: command.sentBy,
            body: command.body,
            coAuthors: command.coAuthors,
            draftGeneration: command.draftGeneration,
            attachments,
          },
          { taskId, runId, stationId, named: command.runId },
        ),
      );
      await this.drafts.announce(taskId, next, command.body);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
