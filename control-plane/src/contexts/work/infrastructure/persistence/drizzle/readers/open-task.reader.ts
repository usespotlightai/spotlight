import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import type {
  OpenTaskReaderPort,
  OpenTaskReading,
} from '@work/application/ports/open-task-reader.port';
import {
  task,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';

@Injectable()
export class DrizzleOpenTaskReader implements OpenTaskReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async newest(
    lineId: LineId,
    current: TaskId,
    limit: number,
  ): Promise<readonly OpenTaskReading[]> {
    const rows = await this.db
      .select({
        id: task.id,
        title: task.title,
        stationId: task.stationId,
        createdAt: task.createdAt,
        description: task.description,
      })
      .from(task)
      .innerJoin(workStation, eq(workStation.stationId, task.stationId))
      .where(
        and(
          eq(workStation.lineId, lineId.value),
          ne(workStation.kind, 'completed'),
          eq(task.isSetup, false),
          ne(task.id, current.value),
        ),
      )
      .orderBy(desc(task.createdAt), desc(task.id))
      .limit(limit);
    const lastNotes = await this.lastNotes(rows.map((row) => row.id));

    return rows.map((row) => ({
      id: TaskId.of(row.id),
      title: TaskTitle.of(row.title),
      stationId: StationId.of(row.stationId),
      createdAt: row.createdAt,
      description: row.description,
      lastNote: lastNotes.get(row.id) ?? null,
    }));
  }

  private async lastNotes(
    taskIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .selectDistinctOn([taskNote.taskId], {
        taskId: taskNote.taskId,
        body: taskNote.body,
      })
      .from(taskNote)
      .where(inArray(taskNote.taskId, [...taskIds]))
      .orderBy(taskNote.taskId, desc(taskNote.position));

    return new Map(rows.map((row) => [row.taskId, row.body] as const));
  }
}
