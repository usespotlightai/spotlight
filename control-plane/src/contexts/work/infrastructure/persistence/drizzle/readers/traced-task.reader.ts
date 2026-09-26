import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  TracedTask,
  TracedTaskReaderPort,
} from '@work/application/ports/traced-task-reader.port';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleTracedTaskReader implements TracedTaskReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async of(taskIds: readonly TaskId[]): Promise<TracedTask[]> {
    if (taskIds.length === 0) {
      return [];
    }

    return this.db
      .select({ taskId: task.id, title: task.title, teamId: line.teamId })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .where(
        inArray(
          task.id,
          taskIds.map((each) => each.value),
        ),
      );
  }
}
