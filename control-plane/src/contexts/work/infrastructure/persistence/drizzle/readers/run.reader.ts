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
import {
  olderThan,
  pageOf,
  sortableTime,
} from '@platform/persistence/drizzle/keyset';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Page, PageRequest } from '@work/application/dto/page.dto';
import type {
  RunConfigSummary,
  RunConfigView,
  RunNotesSummary,
  RunReaderPort,
  RunStationSummary,
  TaskRunSummary,
  TeamRunSummary,
} from '@work/application/ports/run-reader.port';
import { worksOn } from '@work/domain/services/conversations';
import { threadAt } from '@work/domain/services/station-thread';
import {
  progressOf,
  progressOfCurrentRun,
  takenUpOnAnswer,
} from '@work/domain/value-objects/run-state';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import { taskRunStateOf } from '@work/domain/value-objects/task-run-state';
import { timeCursorOf } from '@work/infrastructure/persistence/drizzle/readers/page-cursor';
import {
  attachmentsFor,
  attachmentsOf,
  awaitedReviewsFor,
  reviewsBy,
  stationsPerLine,
  trailsFor,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { and, desc, eq, isNotNull, lt, ne, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export const ranAt = alias(workStation, 'ran_at');

export type StationRow = {
  stationId: string | null;
  stationName: string | null;
  stationColor: string | null;
  stationPosition: number | null;
  stationLineId: string | null;
};

export const stationSummaryOf = (
  row: StationRow,
  stationCounts: Map<string, number>,
): RunStationSummary | null =>
  row.stationId === null ||
  row.stationName === null ||
  row.stationColor === null ||
  row.stationPosition === null
    ? null
    : {
        id: row.stationId,
        name: row.stationName,
        color: row.stationColor,
        position: row.stationPosition,
        count: stationCounts.get(row.stationLineId ?? '') ?? 1,
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
        superseded: sql<boolean>`coalesce(${dispatch.superseded}, false)`,
        stopRequested: sql<boolean>`${run.stopRequestedAt} is not null`,
        attempt: run.attempt,
        exitCode: run.exitCode,
        startedAt: run.createdAt,
        updatedAt: run.updatedAt,
        harness: run.harness,
        image: run.ranIn,
        stationId: ranAt.stationId,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.lineId,
        workspaceId: run.workspaceId,
        currentRunId: task.currentRunId,
      })
      .from(run)
      .innerJoin(task, eq(task.id, run.taskId))
      .leftJoin(dispatch, eq(dispatch.id, run.id))
      .leftJoin(ranAt, eq(ranAt.stationId, run.stationId))
      .where(eq(run.taskId, taskId.value))
      .orderBy(desc(run.createdAt));
    const rows = await this.visibleTo(viewerId, found);

    const [stationCounts, review, awaited] = await Promise.all([
      stationsPerLine(
        this.db,
        rows.flatMap((row) => (row.stationLineId ? [row.stationLineId] : [])),
      ),
      reviewsBy(this.db, [taskId.value]),
      awaitedReviewsFor(this.db, [taskId.value]),
    ]);

    return rows.map(
      ({
        stationLineId,
        workspaceId: _workspace,
        currentRunId,
        superseded,
        ...rest
      }) => ({
        ...rest,
        state: taskRunStateOf(rest.state, superseded),
        station: stationSummaryOf({ ...rest, stationLineId }, stationCounts),
        review: review.get(rest.id) ?? null,
        takenUpOnAnswer: takenUpOnAnswer(rest.id, {
          currentRunId,
          awaitsPerson: awaited.has(taskId.value),
        }),
      }),
    );
  }

  async listForTeam(
    teamId: TeamId,
    viewerId: UserId,
    page: PageRequest,
  ): Promise<Page<TeamRunSummary>> {
    const before = timeCursorOf(page.before);
    const rows = await this.teamRuns(
      teamId,
      viewerId,
      before ? olderThan(run.createdAt, run.id, before) : undefined,
      page.limit + 1,
    );

    return pageOf(rows, page.limit, (row) => ({
      key: row.cursorAt,
      id: row.id,
    }));
  }

  async findForTeam(
    teamId: TeamId,
    runId: RunId,
    viewerId: UserId,
  ): Promise<TeamRunSummary | null> {
    const [found] = await this.teamRuns(
      teamId,
      viewerId,
      eq(run.id, runId.value),
      1,
    );

    return found ?? null;
  }

  private async teamRuns(
    teamId: TeamId,
    viewerId: UserId,
    narrowedTo: SQL | undefined,
    limit: number,
  ): Promise<(TeamRunSummary & { readonly cursorAt: string })[]> {
    const found = await this.db
      .select({
        id: run.id,
        state: run.state,
        superseded: sql<boolean>`coalesce(${dispatch.superseded}, false)`,
        stopRequested: sql<boolean>`${run.stopRequestedAt} is not null`,
        attempt: run.attempt,
        exitCode: run.exitCode,
        startedAt: run.createdAt,
        updatedAt: run.updatedAt,
        harness: run.harness,
        image: run.ranIn,
        taskId: run.taskId,
        taskTitle: task.title,
        taskDescription: task.description,
        stationId: ranAt.stationId,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.lineId,
        workspaceId: run.workspaceId,
        currentRunId: task.currentRunId,
        cursorAt: sortableTime(run.createdAt),
      })
      .from(run)
      .innerJoin(task, eq(task.id, run.taskId))
      .innerJoin(workStation, eq(workStation.stationId, task.stationId))
      .leftJoin(dispatch, eq(dispatch.id, run.id))
      .leftJoin(ranAt, eq(ranAt.stationId, run.stationId))
      .where(and(eq(workStation.teamId, teamId.value), narrowedTo))
      .orderBy(desc(run.createdAt), desc(run.id))
      .limit(limit);
    const rows = await this.visibleTo(viewerId, found);
    const taskIds = rows.flatMap((row) => (row.taskId ? [row.taskId] : []));

    const [stationCounts, review, awaited] = await Promise.all([
      stationsPerLine(
        this.db,
        rows.flatMap((row) => (row.stationLineId ? [row.stationLineId] : [])),
      ),
      reviewsBy(this.db, taskIds),
      awaitedReviewsFor(this.db, taskIds),
    ]);

    return rows.map(
      ({
        stationLineId,
        workspaceId: _workspace,
        currentRunId,
        superseded,
        ...rest
      }) => ({
        ...rest,
        state: taskRunStateOf(rest.state, superseded),
        station: stationSummaryOf({ ...rest, stationLineId }, stationCounts),
        review: review.get(rest.id) ?? null,
        takenUpOnAnswer: takenUpOnAnswer(rest.id, {
          currentRunId,
          awaitsPerson: rest.taskId !== null && awaited.has(rest.taskId),
        }),
      }),
    );
  }

  async notesFor(
    runId: RunId,
    viewerId: UserId,
  ): Promise<RunNotesSummary | null> {
    const [found] = await this.db
      .select({
        runId: run.id,
        state: run.state,
        stopRequestedAt: run.stopRequestedAt,
        taskId: task.id,
        title: task.title,
        description: task.description,
        workingRunId: task.currentRunId,
        createdAt: task.createdAt,
        briefing: dispatch.briefing,
        stationId: ranAt.stationId,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.lineId,
        workspaceId: run.workspaceId,
      })
      .from(run)
      .innerJoin(task, eq(task.id, run.taskId))
      .leftJoin(dispatch, eq(dispatch.id, run.id))
      .leftJoin(ranAt, eq(ranAt.stationId, run.stationId))
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
    const stationCounts = await stationsPerLine(this.db, [
      found.stationLineId ?? '',
    ]);
    const notes = trail ?? [];
    const [latest = { ...found, superseded: false }] = found.stationId
      ? await this.db
          .select({
            runId: run.id,
            state: run.state,
            superseded: sql<boolean>`coalesce(${dispatch.superseded}, false)`,
            stopRequestedAt: run.stopRequestedAt,
          })
          .from(run)
          .leftJoin(dispatch, eq(dispatch.id, run.id))
          .where(
            and(
              eq(run.taskId, found.taskId),
              eq(run.stationId, found.stationId),
            ),
          )
          .orderBy(desc(run.createdAt))
          .limit(1)
      : [];
    const latestRun = {
      state: latest.state,
      stopRequested: latest.stopRequestedAt !== null,
    };

    return {
      runId: found.runId,
      taskId: found.taskId,
      title: found.title,
      description: found.description,
      attachments: attachmentsOf(attached, found.taskId).own,
      station: stationSummaryOf({ ...found }, stationCounts),
      createdAt: found.createdAt,
      briefing: found.briefing ?? '',
      progress: worksOn(found.workingRunId === latest.runId, notes)
        ? progressOfCurrentRun(latestRun, true)
        : null,
      latestRun: {
        id: latest.runId,
        state: taskRunStateOf(latest.state, latest.superseded),
        progress: progressOf(latestRun),
      },
      notes: threadAt(notes, found.stationId, runId.value),
    };
  }

  async configFor(
    runId: RunId,
    viewerId: UserId,
  ): Promise<RunConfigSummary | null> {
    const [found] = await this.db
      .select({
        runId: dispatch.id,
        kind: dispatch.kind,
        taskId: dispatch.taskId,
        stationId: dispatch.stationId,
        orderedAt: dispatch.orderedAt,
        fingerprint: dispatch.stationFingerprint,
        parts: dispatch.stationConfig,
        workspaceId: dispatch.workspaceId,
      })
      .from(dispatch)
      .where(and(eq(dispatch.id, runId.value), ne(dispatch.kind, 'trial')))
      .limit(1);

    if (
      !found ||
      !(await this.access.mayView(viewerId, WorkspaceId.of(found.workspaceId)))
    ) {
      return null;
    }

    const ran =
      found.fingerprint && found.parts
        ? {
            runId: found.runId,
            fingerprint: found.fingerprint,
            parts: found.parts,
          }
        : null;

    if (!ran || !found.stationId || found.kind !== 'task') {
      return { ran, before: null };
    }

    const [earlier] = await this.db
      .select({
        runId: dispatch.id,
        taskId: dispatch.taskId,
        fingerprint: dispatch.stationFingerprint,
        parts: dispatch.stationConfig,
      })
      .from(dispatch)
      .where(
        and(
          eq(dispatch.stationId, found.stationId),
          eq(dispatch.kind, 'task'),
          lt(dispatch.orderedAt, found.orderedAt),
          isNotNull(dispatch.stationFingerprint),
        ),
      )
      .orderBy(desc(dispatch.orderedAt))
      .limit(1);

    return {
      ran,
      before: earlier ? configured(earlier) : null,
    };
  }
}

const configured = (row: {
  runId: string;
  taskId: string | null;
  fingerprint: string | null;
  parts: StationConfigParts | null;
}): RunConfigView | null =>
  row.taskId && row.fingerprint && row.parts
    ? {
        runId: row.runId,
        taskId: row.taskId,
        fingerprint: row.fingerprint,
        parts: row.parts,
      }
    : null;
