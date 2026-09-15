import type { StopChatCommand } from '@application/commands/chat.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { ChatAtHand } from '@application/services/chat-at-hand.service';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import { UserId } from '@domain/value-objects/user-id.vo';

export class StopChatHandler
  implements CommandHandlerPort<StopChatCommand, void>
{
  constructor(
    private readonly held: ChatAtHand,
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: StopChatCommand): Promise<void> {
    try {
      const chat = await this.held.inTeam(command.teamId, command.chatId);
      const runId = chat.stoppableBy(UserId.of(command.stoppedBy));
      const run = await this.runs.findById(runId);

      if (!run) {
        throw new UnknownRunError(`there is no run ${runId.value}`);
      }

      const stopping = run.requestStop(this.clock.now());
      await this.runs.save(stopping);

      await this.events.dispatch(stopping.pullEvents());
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
