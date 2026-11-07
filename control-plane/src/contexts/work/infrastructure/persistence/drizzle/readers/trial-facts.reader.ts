import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  TaskRunFacts,
  TrialFactsPort,
} from '@work/application/ports/trial-facts.port';
import { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

@Injectable()
export class DrizzleTrialFacts implements TrialFactsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async ofTaskRuns(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, TaskRunFacts>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        runId: dispatch.id,
        taskId: dispatch.taskId,
        stationId: dispatch.stationId,
        briefed: isNotNull(dispatch.briefedTask).mapWith(Boolean),
        liveTask: task.id,
        title: task.title,
      })
      .from(dispatch)
      .leftJoin(task, eq(task.id, dispatch.taskId))
      .where(
        and(
          inArray(dispatch.id, [...new Set(runIds)]),
          eq(dispatch.kind, 'task'),
        ),
      );

    return new Map(
      rows.flatMap((row) =>
        row.taskId && row.stationId
          ? [
              [
                row.runId,
                {
                  runId: row.runId,
                  taskId: row.taskId,
                  stationId: row.stationId,
                  briefed: row.briefed,
                  taskExists: row.liveTask !== null,
                  title: row.title,
                },
              ] as const,
            ]
          : [],
      ),
    );
  }
}
