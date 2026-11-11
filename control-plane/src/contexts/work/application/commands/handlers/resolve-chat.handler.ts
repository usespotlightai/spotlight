import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ResolveChatCommand } from '@work/application/commands/chat.commands';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';

export class ResolveChatHandler implements CommandHandlerPort<
  ResolveChatCommand,
  void
> {
  constructor(
    private readonly loader: ChatLoader,
    private readonly chats: ChatRepository,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: ResolveChatCommand): Promise<void> {
    try {
      const chat = await this.loader.startedBy(
        command.chatId,
        command.resolvedBy,
      );
      const resolved = chat.resolve(
        UserId.of(command.resolvedBy),
        this.clock.now(),
      );

      if (resolved !== chat) {
        await this.chats.save(resolved);
        this.logger.debug(
          { chatId: command.chatId, action: 'resolve' },
          'Inbox chat changed',
        );
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
