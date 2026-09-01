import type { ReadInboxItemCommand } from '@application/commands/read-inbox-item.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { ConversationAtHand } from '@application/services/conversation-at-hand.service';
import type { TaskRepository } from '@domain/repositories/task.repository';

/** Nobody else hears about the task, so to them it reads as not being there. */
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
