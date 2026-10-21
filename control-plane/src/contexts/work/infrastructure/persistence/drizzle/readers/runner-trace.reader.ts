import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { TaskRunSummary } from '@work/application/ports/run-reader.port';
import type {
  LeasedRunFacts,
  RunnerTraceReaderPort,
} from '@work/application/ports/runner-trace-reader.port';
import { LEASED_RUN_STATES } from '@work/domain/value-objects/run-state';
import {
  ranAt,
  stationSummaryOf,
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
import { alias } from 'drizzle-orm/pg-core';

const replayed = alias(run, 'replayed');

@Injectable()
export class DrizzleRunnerTraceReader implements RunnerTraceReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async leasedRunFacts(
    runId: RunId,
    runnerId: RunnerId,
  ): Promise<LeasedRunFacts | null> {
    const [row] = await this.db
      .select({
        teamId: sql<
          string | null
        >`coalesce(${chat.teamId}, ${line.teamId}, ${run.ranForTeamId})`,
        replayOf: run.replayOfRunId,
        replaysFrom: replayed.startedFromAt,
        searchId: run.searchId,
      })
      .from(run)
      .leftJoin(chat, eq(chat.id, run.chatId))
      .leftJoin(task, eq(task.id, run.taskId))
      .leftJoin(station, eq(station.id, task.stationId))
      .leftJoin(line, eq(line.id, station.lineId))
      .leftJoin(replayed, eq(replayed.id, run.replayOfRunId))
      .where(
        and(
          eq(run.id, runId.value),
          eq(run.claimedBy, runnerId.value),
          inArray(run.state, [...LEASED_RUN_STATES]),
        ),
      )
      .limit(1);

    if (!row?.teamId) {
      return null;
    }

    if (row.replayOf && !row.replaysFrom) {
      throw new InconsistentStateError(
        'run',
        `replays a run that never said where it started (${runId.value})`,
      );
    }

    return {
      teamId: TeamId.of(row.teamId),
      replaysFrom: row.replayOf ? row.replaysFrom : null,
      isSearch: row.searchId !== null,
    };
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
        stopRequested: sql<boolean>`${run.stopRequestedAt} is not null`,
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

    const [stationCounts, review] = await Promise.all([
      stationsPerLine(
        this.db,
        rows.flatMap((row) => (row.stationLineId ? [row.stationLineId] : [])),
      ),
      reviewsBy(this.db, [taskId.value]),
    ]);

    return rows.map(({ stationLineId, ...rest }) => ({
      ...rest,
      station: stationSummaryOf({ ...rest, stationLineId }, stationCounts),
      review: review.get(rest.id) ?? null,
    }));
  }

  async journalsForTask(taskId: TaskId): Promise<RunJournal[]> {
    return journalsOfTask(this.db, taskId);
  }
}
