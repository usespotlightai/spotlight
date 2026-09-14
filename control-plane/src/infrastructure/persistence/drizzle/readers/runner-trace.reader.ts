import type { RunJournal } from '@application/contracts/run-journal.contract';
import type { TaskRunSummary } from '@application/ports/run-reader.port';
import type { RunnerTraceReaderPort } from '@application/ports/runner-trace-reader.port';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  ranAt,
  worked,
} from '@infrastructure/persistence/drizzle/readers/run.reader';
import { journalsOfTask } from '@infrastructure/persistence/drizzle/readers/run-journals';
import {
  reviewsBy,
  stationsPerLine,
} from '@infrastructure/persistence/drizzle/readers/task-trail';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  line,
  station,
} from '@infrastructure/persistence/drizzle/schemas/line.schema';
import { run } from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { task } from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleRunnerTraceReader implements RunnerTraceReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async heldTaskOf(runId: RunId, runnerId: RunnerId): Promise<TaskId | null> {
    const [row] = await this.db
      .select({ taskId: run.taskId })
      .from(run)
      .where(
        and(
          eq(run.id, runId.value),
          eq(run.claimedBy, runnerId.value),
          eq(run.state, 'claimed'),
        ),
      )
      .limit(1);

    return row?.taskId ? TaskId.of(row.taskId) : null;
  }

  async teamOfTask(taskId: TaskId): Promise<TeamId | null> {
    const [row] = await this.db
      .select({ teamId: factory.teamId })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .where(eq(task.id, taskId.value))
      .limit(1);

    return row?.teamId ? TeamId.of(row.teamId) : null;
  }

  async runsForTask(taskId: TaskId): Promise<TaskRunSummary[]> {
    const rows = await this.db
      .select({
        id: run.id,
        state: run.state,
        attempt: run.attempt,
        exitCode: run.exitCode,
        startedAt: run.createdAt,
        updatedAt: run.updatedAt,
        harness: run.harness,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.lineId,
      })
      .from(run)
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .where(eq(run.taskId, taskId.value))
      .orderBy(desc(run.createdAt));

    const [held, review] = await Promise.all([
      stationsPerLine(
        this.db,
        rows.flatMap((row) => (row.stationLineId ? [row.stationLineId] : [])),
      ),
      reviewsBy(this.db, [taskId.value]),
    ]);

    return rows.map(({ stationLineId, ...rest }) => ({
      ...rest,
      station: worked({ ...rest, stationLineId }, held),
      review: review.get(rest.id) ?? null,
    }));
  }

  async journalsForTask(taskId: TaskId): Promise<RunJournal[]> {
    return journalsOfTask(this.db, taskId);
  }
}
