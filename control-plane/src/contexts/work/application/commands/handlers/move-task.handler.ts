import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { MoveTaskCommand } from '@work/application/commands/move-task.command';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { LineAtHand } from '@work/application/services/line-at-hand.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export class MoveTaskHandler
  implements CommandHandlerPort<MoveTaskCommand, TaskDto>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineAtHand,
    private readonly transaction: TransactionPort,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
    private readonly people: PersonReaderPort,
  ) {}

  async execute(command: MoveTaskCommand): Promise<TaskDto> {
    try {
      return await this.move(command);
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async move(command: MoveTaskCommand): Promise<TaskDto> {
    const stationId = StationId.of(command.stationId);

    return await this.transaction.run(async () => {
      const line = await this.lines.onTeam(
        command.teamId,
        command.lineId,
        command.viewerId,
      );

      const task = await this.tasks.find(TaskId.of(command.taskId));

      if (!task) {
        throw new UnknownTaskError(command.taskId);
      }

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
