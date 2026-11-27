import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { BlockTaskCommand } from '@work/application/commands/block-task.command';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { SeenBlockers } from '@work/application/services/seen-blockers';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class BlockTaskHandler implements CommandHandlerPort<
  BlockTaskCommand,
  void
> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly access: WorkAccess,
    private readonly transaction: TransactionPort,
    private readonly lines: LineMapsPort,
    private readonly blockers: SeenBlockers,
  ) {}

  async execute(command: BlockTaskCommand): Promise<void> {
    try {
      await this.block(command);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async block(command: BlockTaskCommand): Promise<void> {
    const teamId = TeamId.of(command.teamId);
    const viewer = UserId.of(command.viewerId);

    (await this.access.standingOn(teamId, viewer)).assertActsOnTasks(
      () => new UnknownTaskError(command.taskId),
    );

    await this.transaction.inTransaction(async () => {
      const task = await this.tasks.find(TaskId.of(command.taskId));
      const line = task ? await this.lines.findByStation(task.stationId) : null;

      if (!task || !line?.teamId.equals(teamId)) {
        throw new UnknownTaskError(command.taskId);
      }

      await this.tasks.save(
        task.blockBy(
          line,
          await this.blockers.named(command.blockedBy, viewer),
          await this.tasks.blockingIn(task.workspaceId),
        ),
      );
    });
  }
}
