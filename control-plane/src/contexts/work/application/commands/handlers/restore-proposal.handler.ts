import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RestoreProposalCommand } from '@work/application/commands/chat.commands';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class RestoreProposalHandler implements CommandHandlerPort<
  RestoreProposalCommand,
  void
> {
  constructor(
    private readonly loader: ChatLoader,
    private readonly chats: ChatRepository,
  ) {}

  async execute(command: RestoreProposalCommand): Promise<void> {
    try {
      const chat = await this.loader.openedBy(
        command.teamId,
        command.chatId,
        command.restoredBy,
      );

      await this.chats.save(
        chat.restoreProposal(
          MessagePosition.of(command.position),
          UserId.of(command.restoredBy),
        ),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
