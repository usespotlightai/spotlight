import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AddTaskCommand } from '@work/application/commands/add-task.command';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { CreateTask } from '@work/application/services/create-task';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { LineLoader } from '@work/application/services/line-loader.service';
import { queuedOf } from '@work/application/services/queued-of';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { Placement } from '@work/domain/services/placement';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';

export class AddTaskHandler
  implements CommandHandlerPort<AddTaskCommand, TaskDto>
{
  constructor(
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineLoader,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly createTask: CreateTask,
    private readonly people: PersonReaderPort,
    private readonly files: FilesLoader,
    private readonly runs: RunRepository,
  ) {}

  async execute(command: AddTaskCommand): Promise<TaskDto> {
    try {
      return await this.addTask(command);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async addTask(command: AddTaskCommand): Promise<TaskDto> {
    const stationId = StationId.of(command.stationId);
    const createdBy = UserId.of(command.createdBy);

    const line = await this.lines.onTeam(
      command.teamId,
      command.lineId,
      createdBy.value,
    );
    const placed = await this.placements.placementsAt(stationId);

    const attachments = await this.files.handedOver(
      line.workspaceId,
      command.attachments,
    );

    const added = Task.add({
      line,
      at: stationId,
      title: TaskTitle.of(command.title),
      description: command.description
        ? TaskDescription.of(command.description)
        : null,
      attachments,
      rank: Placement.atTheBack(placed.map((each) => each.rank)),
      createdBy,
      now: this.clock.now(),
      newId: () => this.ids.generate(),
    });

    const created = await this.createTask.create({ task: added, line });

    const person = await this.people.find(createdBy);

    return TaskMapper.taskToDto(
      created,
      person,
      created.assignee ? person : null,
      await queuedOf(this.runs, created),
    );
  }
}
