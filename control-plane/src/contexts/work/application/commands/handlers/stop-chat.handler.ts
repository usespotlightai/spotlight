import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { StopChatCommand } from '@work/application/commands/chat.commands';
import type { ChatAtHand } from '@work/application/services/chat-at-hand.service';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class StopChatHandler
  implements CommandHandlerPort<StopChatCommand, void>
{
  constructor(
    private readonly held: ChatAtHand,
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
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
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
