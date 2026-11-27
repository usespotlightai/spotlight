import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { BlockTaskCommand } from '@work/application/commands/block-task.command';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskBlockingPort } from '@work/application/ports/task-blocking.port';
import type { SeenBlockers } from '@work/application/services/seen-blockers';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Blocking } from '@work/domain/services/blocking';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

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
    private readonly blocking: TaskBlockingPort,
    private readonly clock: ClockPort,
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

      await this.blocking.lockIn(task.workspaceId);

      const named = await this.blockers.named(command.blockedBy, viewer);
      const blockedBy = Blocking.forTask(
        task,
        named,
        await this.blocking.graphIn(task.workspaceId),
      );

      const blocked = task.blockBy(line, blockedBy, viewer, {
        line,
        body: TaskNoteBody.blockedBy(
          named
            .filter((each) => blockedBy.some((id) => id.equals(each.id)))
            .map((each) => each.title),
        ),
        at: this.clock.now(),
        voice: Voice.station(),
      });

      if (blocked !== task) {
        await this.tasks.save(blocked);
      }
    });
  }
}
