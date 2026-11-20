import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { SendTaskMessageCommand } from '@work/application/commands/send-task-message.command';
import type { DraftSending } from '@work/application/services/draft-sending.service';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { LineLoader } from '@work/application/services/line-loader.service';
import type { MessageSending } from '@work/application/services/message-sending.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class SendTaskMessageHandler implements CommandHandlerPort<
  SendTaskMessageCommand,
  void
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineLoader,
    private readonly transaction: TransactionPort,
    private readonly files: FilesLoader,
    private readonly drafts: DraftSending,
    private readonly sending: MessageSending,
  ) {}

  async execute(command: SendTaskMessageCommand): Promise<void> {
    try {
      const unknown = () => new UnknownTaskError(command.taskId);
      const task = await this.tasks.find(TaskId.of(command.taskId));

      if (!task) {
        throw unknown();
      }

      await this.lines.atStation(
        command.teamId,
        task.stationId,
        command.sentBy,
        unknown,
      );

      const attachments = await this.files.handedOver(
        task.workspaceId,
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
          {
            taskId: task.id,
            runId: null,
            stationId: null,
            named: command.taskId,
          },
        ),
      );
      await this.drafts.announce(task.id, next, command.body);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
