import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { OpenTaskReaderPort } from '@work/application/ports/open-task-reader.port';
import { excerptOf } from '@work/application/rendering/excerpt';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { OPEN_TASKS } from '@work/domain/value-objects/built-in-tools';

const MAX_TASKS = 50;

const EXCERPT_LENGTH = 600;

export class OpenTasksToolUse implements BuiltInToolUse<TaskToolContext> {
  readonly tool = OPEN_TASKS;

  constructor(
    private readonly lines: LineMapsPort,
    private readonly tasks: OpenTaskReaderPort,
  ) {}

  async call({ taskId, stationId }: TaskToolContext): Promise<unknown> {
    const line = await this.lines.findByStation(stationId);

    if (!line) {
      throw new UnknownStationError(stationId.value);
    }

    const newest = await this.tasks.newest(line.id, taskId, MAX_TASKS + 1);

    const tasks = newest.slice(0, MAX_TASKS).flatMap((each) => {
      const station = line.stationAt(each.stationId);

      return station
        ? [
            {
              id: each.id.value,
              title: each.title.value,
              station: station.key.value,
              createdAt: each.createdAt.toISOString(),
              description: excerptOf(each.description, EXCERPT_LENGTH),
              lastNote: excerptOf(each.lastNote, EXCERPT_LENGTH),
            },
          ]
        : [];
    });

    return {
      tasks,
      more:
        newest.length > MAX_TASKS ||
        tasks.length < Math.min(newest.length, MAX_TASKS),
    };
  }
}
