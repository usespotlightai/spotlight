import type { UnlabelTaskCommand } from '@application/commands/unlabel-task.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import { UnknownLabelError } from '@domain/exceptions/unknown-label.error';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { LabelRepository } from '@domain/repositories/label.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { LabelId } from '@domain/value-objects/label-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class UnlabelTaskHandler
  implements CommandHandlerPort<UnlabelTaskCommand, void>
{
  constructor(
    private readonly labels: LabelRepository,
    private readonly tasks: TaskRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(command: UnlabelTaskCommand): Promise<void> {
    try {
      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team?.holds(UserId.of(command.viewerId))) {
        throw new UnknownTaskError(command.taskId);
      }

      const label = await this.labels.find(LabelId.of(command.labelId));

      if (!label?.teamId.equals(TeamId.of(command.teamId))) {
        throw new UnknownLabelError(command.labelId);
      }

      const task = await this.tasks.find(TaskId.of(command.taskId));

      if (!task?.workspaceId.equals(team.workspaceId)) {
        throw new UnknownTaskError(command.taskId);
      }

      await this.labels.detachFromTask(
        LabelId.of(command.labelId),
        TaskId.of(command.taskId),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
