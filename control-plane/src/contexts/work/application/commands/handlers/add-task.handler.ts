import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AddTaskCommand } from '@work/application/commands/add-task.command';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { CreateTask } from '@work/application/services/create-task';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { LineLoader } from '@work/application/services/line-loader.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Placement } from '@work/domain/services/placement';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';

export class AddTaskHandler implements CommandHandlerPort<
  AddTaskCommand,
  string
> {
  constructor(
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineLoader,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly createTask: CreateTask,
    private readonly files: FilesLoader,
  ) {}

  async execute(command: AddTaskCommand): Promise<string> {
    try {
      return await this.addTask(command);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async addTask(command: AddTaskCommand): Promise<string> {
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
      rank: Placement.entering(
        'opened',
        placed.map((each) => each.rank),
      ),
      createdBy,
      now: this.clock.now(),
      newId: () => this.ids.generate(),
    });

    const created = await this.createTask.create({ task: added, line });

    return created.id.value;
  }
}
