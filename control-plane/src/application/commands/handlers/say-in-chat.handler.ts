import type { SayInChatCommand } from '@application/commands/chat.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { ChatAtHand } from '@application/services/chat-at-hand.service';
import type { ChatDispatching } from '@application/services/chat-dispatch';
import type { FilesAtHand } from '@application/services/files-at-hand.service';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import { UserId } from '@domain/value-objects/user-id.vo';

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
          body: command.body,
          attachments,
          at: this.clock.now(),
        });

        await this.chats.save(
          said.running ? said : await this.dispatch.takenUp(said),
        );
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
