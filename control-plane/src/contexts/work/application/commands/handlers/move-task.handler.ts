import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { MoveTaskCommand } from '@work/application/commands/move-task.command';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { LineLoader } from '@work/application/services/line-loader.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export class MoveTaskHandler
  implements CommandHandlerPort<MoveTaskCommand, TaskDto>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineLoader,
    private readonly transaction: TransactionPort,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
    private readonly people: PersonReaderPort,
  ) {}

  async execute(command: MoveTaskCommand): Promise<TaskDto> {
    try {
      return await this.move(command);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async move(command: MoveTaskCommand): Promise<TaskDto> {
    const stationId = StationId.of(command.stationId);

    return await this.transaction.inTransaction(async () => {
      const line = await this.lines.onTeam(
        command.teamId,
        command.lineId,
        command.viewerId,
      );

      const found = await this.tasks.find(TaskId.of(command.taskId));

      if (!found) {
        throw new UnknownTaskError(command.taskId);
      }

      const task = found.assertRevision(
        TaskRevision.of(command.expectedRevision),
      );

      const station = line.stationAt(stationId);

      if (!station) {
        throw new UnknownStationError(command.stationId);
      }

      const standing = (await this.placements.placementsAt(stationId)).filter(
        (each) => !each.id.equals(task.id),
      );

      const after = command.afterTaskId
        ? standing.find((each) => each.id.value === command.afterTaskId)
        : null;

      if (command.afterTaskId && !after) {
        throw new UnknownTaskError(command.afterTaskId);
      }

      const rank = Placement.below(
        standing.map((each) => each.rank),
        after?.rank ?? null,
      );

      const from = line.stationAt(task.stationId);
      const stayed = task.stationId.equals(stationId);
      const moved = stayed
        ? task.reorderTo(rank)
        : task.moveTo(
            line,
            stationId,
            rank,
            {
              station: from?.name ?? station.name,
              body: TaskNoteBody.movedTo(station.name),
              at: this.clock.now(),
              voice: Voice.station(),
            },
            { mover: UserId.of(command.viewerId) },
          );

      const runId =
        !stayed && moved.wantsRun(line)
          ? await this.dispatch.runIdFor({ task: moved, line })
          : null;

      const placed = runId ? moved.handedTo(runId, line) : moved;

      await this.tasks.save(placed);

      const raisedBy = placed.raisedBy
        ? await this.people.find(placed.raisedBy)
        : null;
      const assignee = placed.assignee
        ? await this.people.find(placed.assignee)
        : null;

      return TaskMapper.taskToDto(placed, raisedBy, assignee);
    });
  }
}
