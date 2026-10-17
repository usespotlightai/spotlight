import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import {
  holds,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AssignTaskCommand } from '@work/application/commands/assign-task.command';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import { NotATeamMemberError } from '@work/domain/exceptions/not-a-team-member.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class AssignTaskHandler
  implements CommandHandlerPort<AssignTaskCommand, TaskDto>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamDirectoryPort,
    private readonly transaction: TransactionPort,
    private readonly people: PersonReaderPort,
  ) {}

  async execute(command: AssignTaskCommand): Promise<TaskDto> {
    try {
      return await this.assign(command);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async assign(command: AssignTaskCommand): Promise<TaskDto> {
    return await this.transaction.inTransaction(async () => {
      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team || !holds(team, UserId.of(command.viewerId))) {
        throw new UnknownTaskError(command.taskId);
      }

      const assignee = command.assigneeId
        ? UserId.of(command.assigneeId)
        : null;

      if (assignee && !holds(team, assignee)) {
        throw new NotATeamMemberError();
      }

      const task = await this.tasks.find(TaskId.of(command.taskId));

      if (!task?.workspaceId.equals(team.workspaceId)) {
        throw new UnknownTaskError(command.taskId);
      }

      const assigned = assignee ? task.assign(assignee) : task.unassign();

      await this.tasks.save(assigned);

      const raisedBy = assigned.raisedBy
        ? await this.people.find(assigned.raisedBy)
        : null;
      const person = assigned.assignee
        ? await this.people.find(assigned.assignee)
        : null;

      return TaskMapper.taskToDto(assigned, raisedBy, person);
    });
  }
}
