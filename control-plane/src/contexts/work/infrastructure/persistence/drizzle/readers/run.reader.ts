import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type {
  RunConversationSummary,
  RunReaderPort,
  RunStationSummary,
  TaskRunSummary,
  TeamRunSummary,
} from '@work/application/ports/run-reader.port';
import { awaitsAPerson, turnOf } from '@work/domain/services/conversations';
import {
  attachmentsFor,
  attachmentsOf,
  reviewsBy,
  stationsPerLine,
  trailsFor,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { desc, eq } from 'drizzle-orm';
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
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(WORKSPACE_ACCESS) private readonly access: WorkspaceAccessPort,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
  ) {}

  private async visibleTo<Row extends { workspaceId: string }>(
    viewer: UserId,
    rows: readonly Row[],
  ): Promise<Row[]> {
    const visible = await this.access.viewableBy(
      viewer,
      rows.map((row) => WorkspaceId.of(row.workspaceId)),
    );

    return rows.filter((row) => visible.has(row.workspaceId));
  }

  async listForTask(
    taskId: TaskId,
    viewerId: UserId,
  ): Promise<TaskRunSummary[]> {
    const found = await this.db
      .select({
        id: run.id,
        state: run.state,
        attempt: run.attempt,
        exitCode: run.exitCode,
        startedAt: run.createdAt,
        updatedAt: run.updatedAt,
        harness: run.harness,
        image: run.ranIn,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.lineId,
        workspaceId: run.workspaceId,
      })
      .from(run)
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .where(eq(run.taskId, taskId.value))
      .orderBy(desc(run.createdAt));
    const rows = await this.visibleTo(viewerId, found);

    const [held, review] = await Promise.all([
      stationsPerLine(
        this.db,
        rows.flatMap((row) => (row.stationLineId ? [row.stationLineId] : [])),
      ),
      reviewsBy(this.db, [taskId.value]),
    ]);

    return rows.map(({ stationLineId, workspaceId: _workspace, ...rest }) => ({
      ...rest,
      station: worked({ ...rest, stationLineId }, held),
      review: review.get(rest.id) ?? null,
    }));
  }

  async listForTeam(
    teamId: TeamId,
    viewerId: UserId,
  ): Promise<TeamRunSummary[]> {
    const found = await this.db
      .select({
        id: run.id,
        state: run.state,
        attempt: run.attempt,
        exitCode: run.exitCode,
        startedAt: run.createdAt,
        updatedAt: run.updatedAt,
        harness: run.harness,
        image: run.ranIn,
        taskId: run.taskId,
        taskTitle: task.title,
        taskDescription: task.description,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.lineId,
        workspaceId: run.workspaceId,
      })
      .from(run)
      .innerJoin(task, eq(task.id, run.taskId))
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .where(eq(line.teamId, teamId.value))
      .orderBy(desc(run.createdAt));
    const rows = await this.visibleTo(viewerId, found);

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

    return rows.map(({ stationLineId, workspaceId: _workspace, ...rest }) => ({
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
        stationLineId: ranAt.lineId,
        workspaceId: run.workspaceId,
      })
      .from(run)
      .innerJoin(task, eq(task.id, run.taskId))
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .where(eq(run.id, runId.value))
      .limit(1);

    if (
      !found ||
      !(await this.access.mayView(viewerId, WorkspaceId.of(found.workspaceId)))
    ) {
      return null;
    }

    const trail = (await trailsFor(this.db, this.people, [found.taskId])).get(
      found.taskId,
    );
    const attached = await attachmentsFor(this.db, [found.taskId]);
    const held = await stationsPerLine(this.db, [found.stationLineId ?? '']);
    const told = trail ?? [];
    const holding = found.workingRunId === found.runId;
    const said = turnOf(told, runId.value, holding);
    const spec = RunSpecContract.from(found.spec);

    return {
      runId: found.runId,
      taskId: found.taskId,
      title: found.title,
      description: found.description,
      attachments: attachmentsOf(attached, found.taskId).own,
      station: worked({ ...found }, held),
      createdAt: found.createdAt,
      briefing: spec?.briefing ?? null,
      working: holding && !awaitsAPerson(told),
      notes: said,
    };
  }
}
