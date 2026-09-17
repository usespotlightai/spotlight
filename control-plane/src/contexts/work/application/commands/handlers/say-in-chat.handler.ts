import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { SayInChatCommand } from '@work/application/commands/chat.commands';
import type { ChatAtHand } from '@work/application/services/chat-at-hand.service';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { FilesAtHand } from '@work/application/services/files-at-hand.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';

export class SayInChatHandler
  implements CommandHandlerPort<SayInChatCommand, void>
{
  constructor(
    private readonly held: ChatAtHand,
    private readonly chats: ChatRepository,
    private readonly files: FilesAtHand,
    private readonly dispatch: ChatDispatching,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: SayInChatCommand): Promise<void> {
    try {
      await this.transaction.run(async () => {
        const chat = await this.held.inTeam(command.teamId, command.chatId);
        const attachments = await this.files.handedOver(
          chat.workspaceId,
          command.attachments,
        );

        const said = chat.said({
          by: UserId.of(command.saidBy),
          body: ChatMessageBody.given(command.body, attachments),
          attachments,
          at: this.clock.now(),
        });

        await this.chats.save(
          said.wantsFollowUp ? await this.dispatch.takenUp(said) : said,
        );
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
