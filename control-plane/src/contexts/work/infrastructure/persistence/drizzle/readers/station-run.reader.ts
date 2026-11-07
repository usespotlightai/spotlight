import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type {
  EndedRunRow,
  KeyedStation,
  RanConfig,
  StationRunReaderPort,
  StationRunRow,
  StationRunsWanted,
  TracedRows,
  TracedWanted,
  UnfinishedRunRow,
} from '@work/application/ports/station-run-reader.port';
import { TERMINAL_RUN_STATES } from '@work/domain/value-objects/run-state';
import {
  type TaskRunState,
  taskRunStateOf,
} from '@work/domain/value-objects/task-run-state';
import { journalsOfRuns } from '@work/infrastructure/persistence/drizzle/readers/run-journals';
import { stationsPerLine } from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  task,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const replayed = alias(run, 'replayed');

const MOST_UNFINISHED = 200;

@Injectable()
export class DrizzleStationRunReader implements StationRunReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async endedRun(runId: string): Promise<EndedRunRow | null> {
    const [row] = await this.db
      .select({
        runId: run.id,
        workspaceId: run.workspaceId,
        teamId: workStation.teamId,
        lineId: workStation.lineId,
        stationId: workStation.stationId,
        taskId: run.taskId,
        fingerprint: dispatch.stationFingerprint,
        earlier: sql<TaskRunState[]>`array(
          select case when earlier_dispatch.superseded then 'superseded' else earlier.state::text end
          from ${run} as earlier
          left join ${dispatch} as earlier_dispatch on earlier_dispatch.id = earlier.id
          where earlier.task_id = ${run.taskId}
            and earlier.station_id = ${run.stationId}
            and earlier.created_at < ${run.createdAt}
        )`,
        harness: run.harness,
        config: dispatch.stationConfig,
        reviewing: sql<string | null>`${dispatch.briefedTask}->>'reviewing'`,
        queuedAt: run.createdAt,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
      })
      .from(run)
      .innerJoin(workStation, eq(workStation.stationId, run.stationId))
      .leftJoin(dispatch, eq(dispatch.id, run.id))
      .where(
        and(
          eq(run.id, runId),
          isNotNull(run.taskId),
          isNotNull(run.endedAt),
          inArray(run.state, [...TERMINAL_RUN_STATES]),
        ),
      )
      .limit(1);

    return row?.taskId && row.endedAt
      ? { ...row, taskId: row.taskId, endedAt: row.endedAt }
      : null;
  }

  async unfinishedOfTeam(teamId: TeamId): Promise<readonly UnfinishedRunRow[]> {
    const rows = await this.db
      .select({
        runId: run.id,
        lineId: workStation.lineId,
        stationId: workStation.stationId,
        taskId: task.id,
        openedBy: task.createdById,
        harness: run.harness,
        config: dispatch.stationConfig,
        state: run.state,
        stopRequestedAt: run.stopRequestedAt,
        queuedAt: run.createdAt,
        startedAt: run.startedAt,
      })
      .from(run)
      .innerJoin(task, eq(task.id, run.taskId))
      .innerJoin(workStation, eq(workStation.stationId, run.stationId))
      .leftJoin(dispatch, eq(dispatch.id, run.id))
      .where(
        and(
          eq(workStation.teamId, teamId.value),
          notInArray(run.state, [...TERMINAL_RUN_STATES]),
          or(
            inArray(run.state, ['queued', 'claimed']),
            isNotNull(run.stopRequestedAt),
          ),
        ),
      )
      .orderBy(desc(run.createdAt), desc(run.id))
      .limit(MOST_UNFINISHED);

    return rows.map(({ stopRequestedAt, ...row }) => ({
      ...row,
      stopRequested: stopRequestedAt !== null,
    }));
  }

  async configsNamed(
    fingerprints: readonly string[],
  ): Promise<readonly RanConfig[]> {
    if (fingerprints.length === 0) {
      return [];
    }

    const rows = await this.db
      .selectDistinctOn([dispatch.stationFingerprint], {
        fingerprint: dispatch.stationFingerprint,
        parts: dispatch.stationConfig,
      })
      .from(dispatch)
      .where(inArray(dispatch.stationFingerprint, [...fingerprints]));

    return rows.flatMap((row) =>
      row.fingerprint && row.parts
        ? [{ fingerprint: row.fingerprint, parts: row.parts }]
        : [],
    );
  }

  async stationsKeyed(
    teamId: TeamId,
    stationKey: string,
    lineKey: string | null,
  ): Promise<readonly KeyedStation[]> {
    return this.db
      .select({
        stationId: workStation.stationId,
        stationKey: workStation.key,
        stationName: workStation.name,
        lineKey: workStation.lineKey,
        lineName: workStation.lineName,
      })
      .from(workStation)
      .where(
        and(
          eq(workStation.teamId, teamId.value),
          eq(workStation.key, stationKey),
          lineKey === null ? undefined : eq(workStation.lineKey, lineKey),
        ),
      );
  }

  async endedAt(
    stationId: string,
    wanted: StationRunsWanted,
  ): Promise<readonly StationRunRow[]> {
    const rows = await this.db
      .select({
        runId: run.id,
        taskId: run.taskId,
        title: task.title,
        fingerprint: dispatch.stationFingerprint,
        state: run.state,
        superseded: sql<boolean>`coalesce(${dispatch.superseded}, false)`,
        attempt: run.attempt,
        harness: run.harness,
        startedAt: run.createdAt,
        endedAt: run.endedAt,
      })
      .from(run)
      .innerJoin(task, eq(task.id, run.taskId))
      .leftJoin(dispatch, eq(dispatch.id, run.id))
      .where(
        and(
          eq(run.stationId, stationId),
          inArray(run.state, [...TERMINAL_RUN_STATES]),
          isNotNull(run.endedAt),
          wanted.fingerprint === null
            ? undefined
            : eq(dispatch.stationFingerprint, wanted.fingerprint),
          wanted.since === null ? undefined : gte(run.createdAt, wanted.since),
          wanted.until === null ? undefined : lt(run.endedAt, wanted.until),
          wanted.excluding.length === 0
            ? undefined
            : notInArray(run.taskId, [...wanted.excluding]),
        ),
      )
      .orderBy(desc(run.createdAt))
      .limit(wanted.max);

    return rows.flatMap(({ superseded, ...row }) =>
      row.taskId && row.endedAt
        ? [
            {
              ...row,
              state: taskRunStateOf(row.state, superseded),
              taskId: row.taskId,
              endedAt: row.endedAt,
            },
          ]
        : [],
    );
  }

  async endedAmong(
    stationId: string,
    runIds: readonly string[],
  ): Promise<readonly StationRunRow[]> {
    if (runIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        runId: run.id,
        taskId: task.id,
        title: task.title,
        fingerprint: dispatch.stationFingerprint,
        state: run.state,
        superseded: sql<boolean>`coalesce(${dispatch.superseded}, false)`,
        attempt: run.attempt,
        harness: run.harness,
        startedAt: run.createdAt,
        endedAt: run.endedAt,
      })
      .from(run)
      .leftJoin(dispatch, eq(dispatch.id, run.id))
      .leftJoin(replayed, eq(replayed.id, run.replayOfRunId))
      .innerJoin(
        task,
        eq(task.id, sql`coalesce(${run.taskId}, ${replayed.taskId})`),
      )
      .where(
        and(
          inArray(run.id, [...runIds]),
          eq(run.stationId, stationId),
          inArray(run.state, [...TERMINAL_RUN_STATES]),
          isNotNull(run.endedAt),
        ),
      )
      .orderBy(desc(run.createdAt));

    return rows.flatMap(({ superseded, ...row }) =>
      row.endedAt
        ? [
            {
              ...row,
              state: taskRunStateOf(row.state, superseded),
              endedAt: row.endedAt,
            },
          ]
        : [],
    );
  }

  journalsOf(runIds: readonly string[]): Promise<readonly RunJournal[]> {
    return journalsOfRuns(this.db, runIds);
  }

  async traced(wanted: TracedWanted): Promise<TracedRows> {
    const tasks =
      wanted.taskIds.length === 0
        ? []
        : await this.db
            .select({
              taskId: task.id,
              title: task.title,
              description: task.description,
              stationId: task.stationId,
            })
            .from(task)
            .where(inArray(task.id, [...wanted.taskIds]));

    const stationIds = [
      ...new Set([
        ...wanted.stationIds,
        ...tasks.map((each) => each.stationId),
      ]),
    ];
    const found =
      stationIds.length === 0
        ? []
        : await this.db
            .select({
              stationId: workStation.stationId,
              name: workStation.name,
              color: workStation.color,
              position: workStation.position,
              lineId: workStation.lineId,
            })
            .from(workStation)
            .where(inArray(workStation.stationId, stationIds));
    const counts = await stationsPerLine(
      this.db,
      found.map((each) => each.lineId),
    );

    const notes =
      wanted.runIds.length === 0
        ? []
        : await this.db
            .selectDistinctOn([taskNote.taskId], {
              taskId: taskNote.taskId,
              body: taskNote.body,
            })
            .from(taskNote)
            .where(inArray(taskNote.runId, [...wanted.runIds]))
            .orderBy(
              taskNote.taskId,
              desc(taskNote.at),
              desc(taskNote.position),
            );

    return {
      tasks,
      stations: found.map(({ lineId, ...each }) => ({
        ...each,
        stations: counts.get(lineId) ?? 1,
      })),
      notes: new Map(notes.map((each) => [each.taskId, each.body])),
    };
  }
}
