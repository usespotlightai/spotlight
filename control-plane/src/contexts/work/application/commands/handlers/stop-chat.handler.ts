import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { StopChatCommand } from '@work/application/commands/chat.commands';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class StopChatHandler
  implements CommandHandlerPort<StopChatCommand, void>
{
  constructor(
    private readonly chats: ChatLoader,
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: StopChatCommand): Promise<void> {
    try {
      const chat = await this.chats.inTeam(command.teamId, command.chatId);
      const runId = chat.stoppableBy(UserId.of(command.stoppedBy));
      const run = await this.runs.findById(runId);

      if (!run) {
        throw new UnknownRunError(`Run ${runId.value} not found.`);
      }

      const stopping = run.requestStop(this.clock.now());
      await this.runs.save(stopping);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
