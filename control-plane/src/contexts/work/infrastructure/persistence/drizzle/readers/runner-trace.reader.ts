import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { TaskRunSummary } from '@work/application/ports/run-reader.port';
import type { RunnerTraceReaderPort } from '@work/application/ports/runner-trace-reader.port';
import { HELD_RUN_STATES } from '@work/domain/value-objects/run-state';
import {
  ranAt,
  worked,
} from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { journalsOfTask } from '@work/infrastructure/persistence/drizzle/readers/run-journals';
import {
  reviewsBy,
  stationsPerLine,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleRunnerTraceReader implements RunnerTraceReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async teamOfHeldRun(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<TeamId | null> {
    const [row] = await this.db
      .select({
        teamId: sql<string | null>`coalesce(${chat.teamId}, ${line.teamId})`,
      })
      .from(run)
      .leftJoin(chat, eq(chat.id, run.chatId))
      .leftJoin(task, eq(task.id, run.taskId))
      .leftJoin(station, eq(station.id, task.stationId))
      .leftJoin(line, eq(line.id, station.lineId))
      .where(
        and(
          eq(run.id, runId.value),
          eq(run.claimedBy, runnerId.value),
          inArray(run.state, [...HELD_RUN_STATES]),
        ),
      )
      .limit(1);

    return row?.teamId ? TeamId.of(row.teamId) : null;
  }

  async teamOfTask(taskId: TaskId): Promise<TeamId | null> {
    const [row] = await this.db
      .select({ teamId: line.teamId })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
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
        image: run.ranIn,
        stationId: ranAt.id,
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
