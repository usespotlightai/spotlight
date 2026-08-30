import type { ReadInboxItemCommand } from '@application/commands/read-inbox-item.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { ConversationId } from '@domain/value-objects/conversation-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

/** Nobody else hears about the task, so to them it reads as not being there. */
export class ReadInboxItemHandler
  implements CommandHandlerPort<ReadInboxItemCommand, void>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReadInboxItemCommand): Promise<void> {
    try {
      const item = ConversationId.parse(command.itemId);
      const task = await this.tasks.find(item.taskId);

      if (!task?.raisedByThem(UserId.of(command.readBy))) {
        throw new UnknownTaskError(item.taskId.value);
      }

      if (task.unreadFrom(item.from)) {
        await this.tasks.save(task.read(item.from, this.clock.now()));
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
