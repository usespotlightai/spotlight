import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { MarkChatReadCommand } from '@work/application/commands/chat.commands';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';

export class MarkChatReadHandler implements CommandHandlerPort<
  MarkChatReadCommand,
  void
> {
  constructor(
    private readonly loader: ChatLoader,
    private readonly chats: ChatRepository,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: MarkChatReadCommand): Promise<void> {
    try {
      const chat = await this.loader.inInboxOf(
        command.chatId,
        command.slug,
        command.readBy,
      );
      const read = chat.markRead(UserId.of(command.readBy), this.clock.now());

      if (read !== chat) {
        await this.chats.save(read);
        this.logger.debug(
          { chatId: command.chatId, action: 'read' },
          'Inbox chat changed',
        );
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
