import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { KeepTaskDraftCommand } from '@work/application/commands/keep-task-draft.command';
import type { TaskDraftStatesPort } from '@work/application/ports/task-draft-states.port';

export class KeepTaskDraftHandler
  implements CommandHandlerPort<KeepTaskDraftCommand, void>
{
  constructor(private readonly states: TaskDraftStatesPort) {}

  async execute(command: KeepTaskDraftCommand): Promise<void> {
    try {
      await this.states.keep(TaskId.of(command.taskId), command.state);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
