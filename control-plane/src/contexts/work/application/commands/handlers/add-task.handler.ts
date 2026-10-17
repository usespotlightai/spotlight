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
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { LineLoader } from '@work/application/services/line-loader.service';
import type { RaiseTask } from '@work/application/services/raise-task';
import { Task } from '@work/domain/aggregates/task.aggregate';
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
    private readonly raise: RaiseTask,
    private readonly people: PersonReaderPort,
    private readonly files: FilesLoader,
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
    const raisedBy = UserId.of(command.raisedBy);

    const line = await this.lines.onTeam(
      command.teamId,
      command.lineId,
      raisedBy.value,
    );
    const standing = await this.placements.placementsAt(stationId);

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
      rank: Placement.atTheBack(standing.map((each) => each.rank)),
      raisedBy,
      now: this.clock.now(),
      newId: () => this.ids.generate(),
    });

    const raised = await this.raise.raise({ task: added, line });

    const person = await this.people.find(raisedBy);

    return TaskMapper.taskToDto(
      raised,
      person,
      raised.assignee ? person : null,
    );
  }
}
