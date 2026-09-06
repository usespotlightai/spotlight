import type { MoveTaskCommand } from '@application/commands/move-task.command';
import type { TaskDto } from '@application/dto/task.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskMapper } from '@application/mappers/task.mapper';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { UnknownAssemblyLineError } from '@domain/exceptions/unknown-assembly-line.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { Placement } from '@domain/services/placement';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';

export class MoveTaskHandler
  implements CommandHandlerPort<MoveTaskCommand, TaskDto>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
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
      const line = await this.lines.find(AssemblyLineId.of(command.lineId));

      if (!line) {
        throw new UnknownAssemblyLineError(command.lineId);
      }

      const task = await this.tasks.find(TaskId.of(command.taskId));

      if (!task) {
        throw new UnknownTaskError(command.taskId);
      }

      const station = line.stationAt(stationId);

      if (!station) {
        throw new UnknownStationError(command.stationId);
      }
      if (!line.holds(task.stationId)) {
        throw new UnknownStationError(task.stationId.value);
      }

      const standing = (await this.tasks.placementsAt(stationId)).filter(
        (each) => !each.id.equals(task.id),
      );

      const after = command.afterTaskId
        ? standing.find((each) => each.id.value === command.afterTaskId)
        : null;

      if (command.afterTaskId && !after) {
        throw new UnknownTaskError(command.afterTaskId);
      }

      const rank = Placement.below(standing, after ?? null);

      const from = line.stationAt(task.stationId);
      const stayed = task.stationId.equals(stationId);
      const moved = stayed
        ? task.reorderTo(rank)
        : // Moved by hand is still a move, and what a person was owed where
          // it stood, they are owed no longer.
          task.moveTo(
            station,
            rank,
            {
              station: from?.name ?? station.name,
              body: TaskNoteBody.movedTo(station.name),
              at: this.clock.now(),
              voice: Voice.station(),
            },
            { from: from ?? null, mover: UserId.of(command.viewerId) },
          );

      const runId =
        stayed || moved.running
          ? null
          : await this.dispatch.dispatch({ task: moved, line });

      const placed = runId ? moved.handedTo(runId) : moved;

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
