import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AssignTaskCommand } from '@work/application/commands/assign-task.command';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class AssignTaskHandler implements CommandHandlerPort<
  AssignTaskCommand,
  void
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly access: WorkAccess,
    private readonly transaction: TransactionPort,
    private readonly lines: LineMapsPort,
  ) {}

  async execute(command: AssignTaskCommand): Promise<void> {
    try {
      await this.assign(command);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async assign(command: AssignTaskCommand): Promise<void> {
    const teamId = TeamId.of(command.teamId);

    (
      await this.access.standingOn(teamId, UserId.of(command.viewerId))
    ).assertActsOnTasks(() => new UnknownTaskError(command.taskId));

    const members = await this.access.membersOf(teamId);

    await this.transaction.inTransaction(async () => {
      const task = await this.tasks.find(TaskId.of(command.taskId));
      const line = task ? await this.lines.findByStation(task.stationId) : null;

      if (!task || !members || !line?.teamId.equals(teamId)) {
        throw new UnknownTaskError(command.taskId);
      }

      await this.tasks.save(
        command.assigneeId
          ? task.assign(UserId.of(command.assigneeId), members)
          : task.unassign(),
      );
    });
  }
}
