import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AcceptProposalCommand } from '@work/application/commands/chat.commands';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class AcceptProposalHandler
  implements CommandHandlerPort<AcceptProposalCommand, void>
{
  constructor(
    private readonly loader: ChatLoader,
    private readonly chats: ChatRepository,
    private readonly clock: ClockPort,
    private readonly access: WorkAccess,
  ) {}

  async execute(command: AcceptProposalCommand): Promise<void> {
    try {
      const chat = await this.loader.openedBy(
        command.teamId,
        command.chatId,
        command.acceptedBy,
      );
      const acceptedBy = UserId.of(command.acceptedBy);
      const accepted = chat.accept(
        MessagePosition.of(command.position),
        acceptedBy,
        this.clock.now(),
      );

      (await this.access.standingOn(chat.teamId, acceptedBy)).assertActsOnTasks(
        () => new UnknownChatError(command.chatId),
      );

      await this.chats.save(accepted);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
