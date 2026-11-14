import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TakeConversationCommand } from '@work/application/commands/take-conversation.command';
import type { ConversationLoader } from '@work/application/services/conversation-loader.service';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class TakeConversationHandler implements CommandHandlerPort<
  TakeConversationCommand,
  void
> {
  constructor(
    private readonly conversations: ConversationLoader,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(command: TakeConversationCommand): Promise<void> {
    try {
      const { item, task, members } = await this.conversations.putTo(
        command.conversationId,
        command.takenBy,
      );

      await this.tasks.save(
        task.take(item.from, UserId.of(command.takenBy), members),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
