import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ReopenChatCommand } from '@work/application/commands/chat.commands';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';

export class ReopenChatHandler implements CommandHandlerPort<
  ReopenChatCommand,
  void
> {
  constructor(
    private readonly loader: ChatLoader,
    private readonly chats: ChatRepository,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: ReopenChatCommand): Promise<void> {
    try {
      const chat = await this.loader.startedBy(
        command.chatId,
        command.reopenedBy,
      );
      const reopened = chat.reopen(UserId.of(command.reopenedBy));

      if (reopened !== chat) {
        await this.chats.save(reopened);
        this.logger.debug(
          { chatId: command.chatId, action: 'reopen' },
          'Inbox chat changed',
        );
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
