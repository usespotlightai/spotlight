import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { SendChatMessageCommand } from '@work/application/commands/chat.commands';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { TracesLoader } from '@work/application/services/traces-loader.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';

export class SendChatMessageHandler
  implements CommandHandlerPort<SendChatMessageCommand, void>
{
  constructor(
    private readonly loader: ChatLoader,
    private readonly chats: ChatRepository,
    private readonly files: FilesLoader,
    private readonly traces: TracesLoader,
    private readonly dispatch: ChatDispatching,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: SendChatMessageCommand): Promise<void> {
    try {
      await this.transaction.inTransaction(async () => {
        const chat = await this.loader.inTeam(command.teamId, command.chatId);
        const attachments = await this.files.handedOver(
          chat.workspaceId,
          command.attachments,
        );
        const traces = await this.traces.shared(command.traces);

        const withMessage = chat.addMessage({
          by: UserId.of(command.sentBy),
          body: ChatMessageBody.fromInput(command.body, attachments, traces),
          attachments,
          traces,
          ...(command.model !== undefined && {
            model:
              command.model === null ? null : HarnessModel.of(command.model),
          }),
          ...(command.effort !== undefined && {
            effort: command.effort === null ? null : Effort.of(command.effort),
          }),
          at: this.clock.now(),
        });

        await this.chats.save(
          withMessage.wantsFollowUp
            ? await this.dispatch.takenUp(withMessage)
            : withMessage,
        );
        await this.files.takenIn(chat.workspaceId, attachments);
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
