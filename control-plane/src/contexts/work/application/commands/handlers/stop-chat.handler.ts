import type { RunsPort } from '@runs/application/ports/runs.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { StopChatCommand } from '@work/application/commands/chat.commands';
import type { ChatLoader } from '@work/application/services/chat-loader.service';

export class StopChatHandler implements CommandHandlerPort<
  StopChatCommand,
  void
> {
  constructor(
    private readonly chats: ChatLoader,
    private readonly runs: RunsPort,
  ) {}

  async execute(command: StopChatCommand): Promise<void> {
    try {
      const chat = await this.chats.openedBy(
        command.teamId,
        command.chatId,
        command.stoppedBy,
      );

      await this.runs.requestStop(
        chat.stoppableBy(UserId.of(command.stoppedBy)),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
