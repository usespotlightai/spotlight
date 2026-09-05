import type { SetTaskRepositoryCommand } from '@application/commands/set-task-repository.command';
import type { TaskDto } from '@application/dto/task.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskMapper } from '@application/mappers/task.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { Repository } from '@domain/value-objects/repository.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

/** Points a task at the repository a run works it in, or clears it. */
export class SetTaskRepositoryHandler
  implements CommandHandlerPort<SetTaskRepositoryCommand, TaskDto>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamRepository,
    private readonly transaction: TransactionPort,
    private readonly people: PersonReaderPort,
  ) {}

  async execute(command: SetTaskRepositoryCommand): Promise<TaskDto> {
    try {
      return await this.set(command);
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async set(command: SetTaskRepositoryCommand): Promise<TaskDto> {
    return await this.transaction.run(async () => {
      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team?.holds(UserId.of(command.viewerId))) {
        throw new UnknownTaskError(command.taskId);
      }

      const task = await this.tasks.find(TaskId.of(command.taskId));

      if (!task?.workspaceId.equals(team.workspaceId)) {
        throw new UnknownTaskError(command.taskId);
      }

      const pointed = task.worksIn(
        command.repository ? Repository.of(command.repository) : null,
      );

      await this.tasks.save(pointed);

      const raisedBy = pointed.raisedBy
        ? await this.people.find(pointed.raisedBy)
        : null;
      const assignee = pointed.assignee
        ? await this.people.find(pointed.assignee)
        : null;

      return TaskMapper.taskToDto(pointed, raisedBy, assignee);
    });
  }
}
