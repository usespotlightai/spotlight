import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AcceptProposalCommand } from '@work/application/commands/chat.commands';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class AcceptProposalHandler
  implements CommandHandlerPort<AcceptProposalCommand, void>
{
  constructor(
    private readonly loader: ChatLoader,
    private readonly chats: ChatRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AcceptProposalCommand): Promise<void> {
    try {
      const chat = await this.loader.inTeam(command.teamId, command.chatId);
      const accepted = chat.accept(
        MessagePosition.of(command.position),
        UserId.of(command.acceptedBy),
        this.clock.now(),
      );

      await this.chats.save(accepted);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
