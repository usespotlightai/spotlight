import type { DismissProposalCommand } from '@application/commands/chat.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { ChatAtHand } from '@application/services/chat-at-hand.service';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import { MessagePosition } from '@domain/value-objects/message-position.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class DismissProposalHandler
  implements CommandHandlerPort<DismissProposalCommand, void>
{
  constructor(
    private readonly held: ChatAtHand,
    private readonly chats: ChatRepository,
    private readonly clock: ClockPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: DismissProposalCommand): Promise<void> {
    try {
      const chat = await this.held.inTeam(command.teamId, command.chatId);
      const dismissed = chat.dismiss(
        MessagePosition.of(command.position),
        UserId.of(command.dismissedBy),
        this.clock.now(),
      );

      await this.chats.save(dismissed);
      await this.events.dispatch(dismissed.pullEvents());
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
