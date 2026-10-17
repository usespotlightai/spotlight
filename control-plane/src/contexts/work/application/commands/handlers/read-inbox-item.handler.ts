import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { ReadInboxItemCommand } from '@work/application/commands/read-inbox-item.command';
import type { ConversationLoader } from '@work/application/services/conversation-loader.service';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class ReadInboxItemHandler
  implements CommandHandlerPort<ReadInboxItemCommand, void>
{
  constructor(
    private readonly conversations: ConversationLoader,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReadInboxItemCommand): Promise<void> {
    try {
      const { item, task } = await this.conversations.putTo(
        command.itemId,
        command.readBy,
      );

      if (task.unreadFrom(item.from)) {
        await this.tasks.save(task.read(item.from, this.clock.now()));
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
