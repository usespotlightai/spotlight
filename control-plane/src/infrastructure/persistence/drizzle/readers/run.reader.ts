import { RunSpecContract } from '@application/contracts/run-spec.contract';
import type {
  RunConversationSummary,
  RunReaderPort,
  RunStationSummary,
  TaskRunSummary,
  TeamRunSummary,
} from '@application/ports/run-reader.port';
import { turnOf } from '@domain/services/conversations';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  reviewsBy,
  stationsPerLine,
  trailsFor,
} from '@infrastructure/persistence/drizzle/readers/task-trail';
import {
  assemblyLine,
  station,
} from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import { run } from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { task } from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { workspaceMember } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export const ranAt = alias(station, 'ran_at');

export type StationRow = {
  stationName: string | null;
  stationColor: string | null;
  stationPosition: number | null;
  stationLineId: string | null;
};

export const worked = (
  row: StationRow,
  held: Map<string, number>,
): RunStationSummary | null =>
  row.stationName === null ||
  row.stationColor === null ||
  row.stationPosition === null
    ? null
    : {
        name: row.stationName,
        color: row.stationColor,
        position: row.stationPosition,
        count: held.get(row.stationLineId ?? '') ?? 1,
      };

@Injectable()
export class DrizzleRunReader implements RunReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTask(
    taskId: TaskId,
    viewerId: UserId,
  ): Promise<TaskRunSummary[]> {
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
        stationLineId: ranAt.assemblyLineId,
      })
      .from(run)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, run.workspaceId),
          eq(workspaceMember.userId, viewerId.value),
        ),
      )
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

  async listForTeam(
    teamId: TeamId,
    viewerId: UserId,
  ): Promise<TeamRunSummary[]> {
    const rows = await this.db
      .select({
        id: run.id,
        state: run.state,
        attempt: run.attempt,
        exitCode: run.exitCode,
        startedAt: run.createdAt,
        updatedAt: run.updatedAt,
        harness: run.harness,
        taskId: run.taskId,
        taskTitle: task.title,
        taskDescription: task.description,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.assemblyLineId,
      })
      .from(run)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, run.workspaceId),
          eq(workspaceMember.userId, viewerId.value),
        ),
      )
      .innerJoin(task, eq(task.id, run.taskId))
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(assemblyLine, eq(assemblyLine.id, station.assemblyLineId))
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(desc(run.createdAt));

    const [held, review] = await Promise.all([
      stationsPerLine(
        this.db,
        rows.flatMap((row) => (row.stationLineId ? [row.stationLineId] : [])),
      ),
      reviewsBy(
        this.db,
        rows.flatMap((row) => (row.taskId ? [row.taskId] : [])),
      ),
    ]);

    return rows.map(({ stationLineId, ...rest }) => ({
      ...rest,
      station: worked({ ...rest, stationLineId }, held),
      review: review.get(rest.id) ?? null,
    }));
  }

  async conversationFor(
    runId: RunId,
    viewerId: UserId,
  ): Promise<RunConversationSummary | null> {
    const [found] = await this.db
      .select({
        runId: run.id,
        state: run.state,
        taskId: task.id,
        title: task.title,
        description: task.description,
        workingRunId: task.currentRunId,
        createdAt: task.createdAt,
        spec: run.spec,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.assemblyLineId,
      })
      .from(run)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, run.workspaceId),
          eq(workspaceMember.userId, viewerId.value),
        ),
      )
      .innerJoin(task, eq(task.id, run.taskId))
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .where(eq(run.id, runId.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const trail = (await trailsFor(this.db, [found.taskId])).get(found.taskId);
    const held = await stationsPerLine(this.db, [found.stationLineId ?? '']);
    const told = trail ?? [];
    const said = turnOf(told, runId.value);
    const spec = RunSpecContract.from(found.spec);

    return {
      runId: found.runId,
      taskId: found.taskId,
      title: found.title,
      description: found.description,
      station: worked({ ...found }, held),
      createdAt: found.createdAt,
      briefing: spec?.briefing ?? null,
      working: found.workingRunId === found.runId,
      notes: said,
    };
  }
}
