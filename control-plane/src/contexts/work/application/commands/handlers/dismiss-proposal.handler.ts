import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { DismissProposalCommand } from '@work/application/commands/chat.commands';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class DismissProposalHandler
  implements CommandHandlerPort<DismissProposalCommand, void>
{
  constructor(
    private readonly loader: ChatLoader,
    private readonly chats: ChatRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DismissProposalCommand): Promise<void> {
    try {
      const chat = await this.loader.inTeam(command.teamId, command.chatId);
      const dismissed = chat.dismiss(
        MessagePosition.of(command.position),
        UserId.of(command.dismissedBy),
        this.clock.now(),
      );

      await this.chats.save(dismissed);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
