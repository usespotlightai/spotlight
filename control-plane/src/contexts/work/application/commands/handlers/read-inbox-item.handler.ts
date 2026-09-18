import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { ReadInboxItemCommand } from '@work/application/commands/read-inbox-item.command';
import type { ConversationAtHand } from '@work/application/services/conversation-at-hand.service';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class ReadInboxItemHandler
  implements CommandHandlerPort<ReadInboxItemCommand, void>
{
  constructor(
    private readonly conversations: ConversationAtHand,
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
      rethrowAsFault(error);
    }
  }
}
