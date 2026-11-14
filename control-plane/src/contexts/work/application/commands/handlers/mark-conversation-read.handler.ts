import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { MarkConversationReadCommand } from '@work/application/commands/mark-conversation-read.command';
import type { ConversationLoader } from '@work/application/services/conversation-loader.service';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ConversationAudience } from '@work/domain/services/conversation-audience';

export class MarkConversationReadHandler implements CommandHandlerPort<
  MarkConversationReadCommand,
  void
> {
  constructor(
    private readonly conversations: ConversationLoader,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: MarkConversationReadCommand): Promise<void> {
    try {
      const { item, task, standing } = await this.conversations.seenBy(
        command.conversationId,
        command.readBy,
      );

      if (
        ConversationAudience.answers(standing) &&
        task.unreadFrom(item.from)
      ) {
        await this.tasks.save(task.read(item.from, this.clock.now()));
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
