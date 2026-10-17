import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { DeleteTaskCommand } from '@work/application/commands/delete-task.command';
import type { LineLoader } from '@work/application/services/line-loader.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class DeleteTaskHandler
  implements CommandHandlerPort<DeleteTaskCommand, void>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineLoader,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    try {
      const found = await this.tasks.find(TaskId.of(command.taskId));

      if (
        !found ||
        !(await this.lines.holding(
          command.teamId,
          found.stationId,
          command.viewerId,
        ))
      ) {
        throw new UnknownTaskError(command.taskId);
      }

      await this.tasks.remove(found.deleted());
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
