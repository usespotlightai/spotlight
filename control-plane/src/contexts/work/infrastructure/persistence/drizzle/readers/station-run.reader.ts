import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type {
  EndedRunRow,
  KeyedStation,
  RanConfig,
  StationAlertRowShape,
  StationRunReaderPort,
  StationRunRow,
  StationRunsWanted,
} from '@work/application/ports/station-run-reader.port';
import {
  type RunState,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import { journalsOfRuns } from '@work/infrastructure/persistence/drizzle/readers/run-journals';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleStationRunReader implements StationRunReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async endedRun(runId: string): Promise<EndedRunRow | null> {
    const [row] = await this.db
      .select({
        runId: run.id,
        workspaceId: run.workspaceId,
        teamId: line.teamId,
        lineId: line.id,
        stationId: station.id,
        taskId: run.taskId,
        fingerprint: run.stationFingerprint,
        earlier: sql<RunState[]>`array(
          select earlier.state::text from ${run} as earlier
          where earlier.task_id = ${run.taskId}
            and earlier.station_id = ${run.stationId}
            and earlier.created_at < ${run.createdAt}
        )`,
        harness: run.harness,
        config: run.stationConfig,
        queuedAt: run.createdAt,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
      })
      .from(run)
      .innerJoin(station, eq(station.id, run.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
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

  async alertsAt(
    stationId: string,
  ): Promise<readonly StationAlertRowShape[] | null> {
    const [row] = await this.db
      .select({ alerts: station.alerts })
      .from(station)
      .where(eq(station.id, stationId))
      .limit(1);

    return row ? row.alerts : null;
  }

  async configsNamed(
    fingerprints: readonly string[],
  ): Promise<readonly RanConfig[]> {
    if (fingerprints.length === 0) {
      return [];
    }

    const rows = await this.db
      .selectDistinctOn([run.stationFingerprint], {
        fingerprint: run.stationFingerprint,
        parts: run.stationConfig,
      })
      .from(run)
      .where(inArray(run.stationFingerprint, [...fingerprints]));

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
        stationId: station.id,
        stationKey: station.key,
        stationName: station.name,
        lineKey: line.key,
        lineName: line.name,
      })
      .from(station)
      .innerJoin(line, eq(line.id, station.lineId))
      .where(
        and(
          eq(line.teamId, teamId.value),
          eq(station.key, stationKey),
          lineKey === null ? undefined : eq(line.key, lineKey),
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
        fingerprint: run.stationFingerprint,
        state: run.state,
        attempt: run.attempt,
        harness: run.harness,
        startedAt: run.createdAt,
        endedAt: run.endedAt,
      })
      .from(run)
      .innerJoin(task, eq(task.id, run.taskId))
      .where(
        and(
          eq(run.stationId, stationId),
          inArray(run.state, [...TERMINAL_RUN_STATES]),
          isNotNull(run.endedAt),
          wanted.fingerprint === null
            ? undefined
            : eq(run.stationFingerprint, wanted.fingerprint),
          wanted.since === null ? undefined : gte(run.createdAt, wanted.since),
        ),
      )
      .orderBy(desc(run.createdAt))
      .limit(wanted.most);

    return rows.flatMap((row) =>
      row.taskId && row.endedAt
        ? [{ ...row, taskId: row.taskId, endedAt: row.endedAt }]
        : [],
    );
  }

  journalsOf(runIds: readonly string[]): Promise<readonly RunJournal[]> {
    return journalsOfRuns(this.db, runIds);
  }
}
