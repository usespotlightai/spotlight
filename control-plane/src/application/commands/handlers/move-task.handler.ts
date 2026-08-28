import type { MoveTaskCommand } from '@application/commands/move-task.command';
import type { TaskDto } from '@application/dto/task.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskMapper } from '@application/mappers/task.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { UnknownAssemblyLineError } from '@domain/exceptions/unknown-assembly-line.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';

export class MoveTaskHandler
  implements CommandHandlerPort<MoveTaskCommand, TaskDto>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly transaction: TransactionPort,
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

      const holds = (id: StationId) =>
        line.stations.some((each) => each.id.equals(id));

      if (!holds(stationId)) {
        throw new UnknownStationError(command.stationId);
      }
      if (!holds(task.stationId)) {
        throw new UnknownStationError(task.stationId.value);
      }

      const moved = task.moveTo(stationId);

      await this.tasks.save(moved);

      return TaskMapper.taskToDto(moved);
    });
  }
}
