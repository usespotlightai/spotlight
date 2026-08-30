import type { DeleteTaskCommand } from '@application/commands/delete-task.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { TaskId } from '@domain/value-objects/task-id.vo';

export class DeleteTaskHandler
  implements CommandHandlerPort<DeleteTaskCommand, void>
{
  constructor(private readonly tasks: TaskRepository) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    try {
      const taskId = TaskId.of(command.taskId);
      const found = await this.tasks.find(taskId);

      if (!found) {
        throw new UnknownTaskError(command.taskId);
      }

      await this.tasks.remove(taskId);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
