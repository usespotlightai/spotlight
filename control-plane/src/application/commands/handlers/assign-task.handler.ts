import type { AssignTaskCommand } from '@application/commands/assign-task.command';
import type { TaskDto } from '@application/dto/task.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskMapper } from '@application/mappers/task.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { NotATeamMemberError } from '@domain/exceptions/not-a-team-member.error';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

/**
 * Gives a task to a team member, or takes it back to unclaimed. Only a member
 * may hand it out, and only a member may be handed it: work stays inside the
 * team that owns the line.
 */
export class AssignTaskHandler
  implements CommandHandlerPort<AssignTaskCommand, TaskDto>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly teams: TeamRepository,
    private readonly transaction: TransactionPort,
    private readonly people: PersonReaderPort,
  ) {}

  async execute(command: AssignTaskCommand): Promise<TaskDto> {
    try {
      return await this.assign(command);
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async assign(command: AssignTaskCommand): Promise<TaskDto> {
    return await this.transaction.run(async () => {
      const team = await this.teams.find(TeamId.of(command.teamId));

      // A team the viewer is not on is turned away exactly like one that is
      // not there, so asking tells nobody what a team holds.
      if (!team?.holds(UserId.of(command.viewerId))) {
        throw new UnknownTaskError(command.taskId);
      }

      const assignee = command.assigneeId
        ? UserId.of(command.assigneeId)
        : null;

      if (assignee && !team.holds(assignee)) {
        throw new NotATeamMemberError();
      }

      const task = await this.tasks.find(TaskId.of(command.taskId));

      // The task has to be one of this team's, or a member could reach a task
      // by naming it under a team that does not hold it.
      if (!task?.workspaceId.equals(team.workspaceId)) {
        throw new UnknownTaskError(command.taskId);
      }

      const assigned = assignee ? task.assignedTo(assignee) : task.unassigned();

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
