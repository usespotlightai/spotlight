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
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type {
  ReplayRunSummary,
  RunConfigSummary,
  RunConfigView,
  RunNotesSummary,
  RunReaderPort,
  RunStationSummary,
  SearchRunSummary,
  TaskRunSummary,
  TeamRunSummary,
} from '@work/application/ports/run-reader.port';
import { awaitsAPerson, threadAt } from '@work/domain/services/conversations';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
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
import { and, desc, eq, isNotNull, lt } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export const ranAt = alias(station, 'ran_at');

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
        workspaceId: run.workspaceId,
      })
      .from(run)
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .where(eq(run.taskId, taskId.value))
      .orderBy(desc(run.createdAt));
    const rows = await this.visibleTo(viewerId, found);

    const [stationCounts, review] = await Promise.all([
      stationsPerLine(
        this.db,
        rows.flatMap((row) => (row.stationLineId ? [row.stationLineId] : [])),
      ),
      reviewsBy(this.db, [taskId.value]),
    ]);

    return rows.map(({ stationLineId, workspaceId: _workspace, ...rest }) => ({
      ...rest,
      station: stationSummaryOf({ ...rest, stationLineId }, stationCounts),
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
        stationId: ranAt.id,
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

    const [stationCounts, review] = await Promise.all([
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
      station: stationSummaryOf({ ...rest, stationLineId }, stationCounts),
      review: review.get(rest.id) ?? null,
    }));
  }

  async notesFor(
    runId: RunId,
    viewerId: UserId,
  ): Promise<RunNotesSummary | null> {
    const [found] = await this.db
      .select({
        runId: run.id,
        state: run.state,
        taskId: task.id,
        title: task.title,
        description: task.description,
        workingRunId: task.currentRunId,
        taskStationId: task.stationId,
        createdAt: task.createdAt,
        spec: run.spec,
        stationId: ranAt.id,
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
    const stationCounts = await stationsPerLine(this.db, [
      found.stationLineId ?? '',
    ]);
    const notes = trail ?? [];
    const workingHere =
      found.workingRunId !== null && found.taskStationId === found.stationId;
    const spec = RunSpecContract.from(found.spec);

    return {
      runId: found.runId,
      taskId: found.taskId,
      title: found.title,
      description: found.description,
      attachments: attachmentsOf(attached, found.taskId).own,
      station: stationSummaryOf({ ...found }, stationCounts),
      createdAt: found.createdAt,
      briefing: spec.briefing,
      working: workingHere && !awaitsAPerson(notes),
      notes: threadAt(notes, found.stationName, runId.value),
    };
  }

  async configFor(
    runId: RunId,
    viewerId: UserId,
  ): Promise<RunConfigSummary | null> {
    const [found] = await this.db
      .select({
        runId: run.id,
        taskId: run.taskId,
        stationId: run.stationId,
        createdAt: run.createdAt,
        fingerprint: run.stationFingerprint,
        parts: run.stationConfig,
        workspaceId: run.workspaceId,
        replayOfRunId: run.replayOfRunId,
        searchId: run.searchId,
        ranForTeamId: run.ranForTeamId,
      })
      .from(run)
      .where(eq(run.id, runId.value))
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

    const ranForTeam =
      found.replayOfRunId || found.searchId
        ? { workspaceId: found.workspaceId, teamId: found.ranForTeamId }
        : null;

    if (!ran || !found.stationId || !found.taskId) {
      return { ran, before: null, ranForTeam };
    }

    const [earlier] = await this.db
      .select({
        runId: run.id,
        taskId: run.taskId,
        fingerprint: run.stationFingerprint,
        parts: run.stationConfig,
      })
      .from(run)
      .where(
        and(
          eq(run.stationId, found.stationId),
          lt(run.createdAt, found.createdAt),
          isNotNull(run.taskId),
          isNotNull(run.stationFingerprint),
        ),
      )
      .orderBy(desc(run.createdAt))
      .limit(1);

    return {
      ran,
      before: earlier ? configured(earlier) : null,
      ranForTeam,
    };
  }

  async searchRunFor(
    teamId: TeamId,
    workspaceId: WorkspaceId,
    runId: RunId,
  ): Promise<SearchRunSummary | null> {
    const [found] = await this.db
      .select({
        id: run.id,
        state: run.state,
        attempt: run.attempt,
        exitCode: run.exitCode,
        startedAt: run.createdAt,
        updatedAt: run.updatedAt,
        endedAt: run.endedAt,
        failure: run.failure,
        harness: run.harness,
        image: run.ranIn,
        stationId: ranAt.id,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.lineId,
        ranForTeamId: run.ranForTeamId,
        workspaceId: run.workspaceId,
        searchId: run.searchId,
        iteration: run.searchIteration,
        spec: run.spec,
      })
      .from(run)
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .where(and(eq(run.id, runId.value), isNotNull(run.searchId)))
      .limit(1);

    if (
      !found?.searchId ||
      found.iteration === null ||
      found.ranForTeamId !== teamId.value ||
      found.workspaceId !== workspaceId.value
    ) {
      return null;
    }

    const stationCounts = await stationsPerLine(
      this.db,
      found.stationLineId ? [found.stationLineId] : [],
    );

    return {
      id: found.id,
      state: found.state,
      attempt: found.attempt,
      exitCode: found.exitCode,
      startedAt: found.startedAt,
      updatedAt: found.updatedAt,
      harness: found.harness,
      image: found.image,
      station: stationSummaryOf(found, stationCounts),
      review: null,
      searchId: found.searchId,
      iteration: found.iteration,
      failure: found.failure,
      endedAt: found.endedAt,
      briefing: RunSpecContract.from(found.spec).briefing,
    };
  }

  async replayFor(
    teamId: TeamId,
    workspaceId: WorkspaceId,
    runId: RunId,
  ): Promise<ReplayRunSummary | null> {
    const [found] = await this.db
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
        ranForTeamId: run.ranForTeamId,
        workspaceId: run.workspaceId,
        originalRunId: run.replayOfRunId,
        originalTaskId: original.taskId,
        originalTitle: task.title,
        spec: run.spec,
        config: run.stationConfig,
      })
      .from(run)
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .leftJoin(line, eq(line.id, ranAt.lineId))
      .leftJoin(original, eq(original.id, run.replayOfRunId))
      .leftJoin(task, eq(task.id, original.taskId))
      .where(and(eq(run.id, runId.value), isNotNull(run.replayOfRunId)))
      .limit(1);

    if (
      !found?.originalRunId ||
      found.ranForTeamId !== teamId.value ||
      found.workspaceId !== workspaceId.value
    ) {
      return null;
    }

    const spec = RunSpecContract.from(found.spec);

    if (!found.config || !spec.replay) {
      throw new InconsistentStateError(
        'run',
        `replays without the configuration or checkouts it ran with (${found.id})`,
      );
    }

    const stationCounts = await stationsPerLine(
      this.db,
      found.stationLineId ? [found.stationLineId] : [],
    );

    return {
      id: found.id,
      state: found.state,
      attempt: found.attempt,
      exitCode: found.exitCode,
      startedAt: found.startedAt,
      updatedAt: found.updatedAt,
      harness: found.harness,
      image: found.image,
      station: stationSummaryOf(found, stationCounts),
      review: null,
      original: {
        runId: found.originalRunId,
        taskId: found.originalTaskId,
        title: found.originalTitle,
      },
      briefing: spec.briefing,
      agent: {
        harness: found.config.harness,
        model: found.config.model,
        effort: found.config.effort,
      },
      repositories: spec.replay.checkouts.map((each) => each.repository),
    };
  }
}

const original = alias(run, 'original');

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
