import type { AddTaskCommand } from '@application/commands/add-task.command';
import type { TaskDto } from '@application/dto/task.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskMapper } from '@application/mappers/task.mapper';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import { Task } from '@domain/aggregates/task.aggregate';
import { UnknownAssemblyLineError } from '@domain/exceptions/unknown-assembly-line.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';

export class AddTaskHandler
  implements CommandHandlerPort<AddTaskCommand, TaskDto>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AddTaskCommand): Promise<TaskDto> {
    try {
      return await this.addTask(command);
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async addTask(command: AddTaskCommand): Promise<TaskDto> {
    const stationId = StationId.of(command.stationId);

    const line = await this.lines.find(AssemblyLineId.of(command.lineId));

    if (!line) {
      throw new UnknownAssemblyLineError(command.lineId);
    }
    if (!line.stations.some((each) => each.id.equals(stationId))) {
      throw new UnknownStationError(command.stationId);
    }

    const added = Task.add({
      workspaceId: line.workspaceId,
      stationId,
      title: TaskTitle.of(command.title),
      description: command.description
        ? TaskDescription.of(command.description)
        : null,
      now: this.clock.now(),
      newId: () => this.ids.generate(),
    });

    await this.tasks.add(added);

    return TaskMapper.taskToDto(added);
  }
}
