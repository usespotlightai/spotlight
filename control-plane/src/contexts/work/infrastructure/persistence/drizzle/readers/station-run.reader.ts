import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunJournal } from '@runs/application/contracts/run-journal.contract';
import {
  RUN_FACTS,
  type RunFacts,
  type RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import {
  RUN_JOURNALS,
  type RunJournalsPort,
} from '@runs/application/ports/run-journals.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { RunReadingMapper } from '@work/application/mappers/run-reading.mapper';
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
import { stationsPerLine } from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';
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
  isNull,
  lt,
  ne,
  notInArray,
  type SQL,
} from 'drizzle-orm';

const MOST_UNFINISHED = 200;

const ended = isNotNull(dispatch.endedAt);

@Injectable()
export class DrizzleStationRunReader implements StationRunReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(RUN_FACTS) private readonly facts: RunFactsPort,
    @Inject(RUN_JOURNALS) private readonly journals: RunJournalsPort,
  ) {}

  async endedRun(runId: string): Promise<EndedRunRow | null> {
    const [row] = await this.db
      .select({
        runId: dispatch.id,
        workspaceId: dispatch.workspaceId,
        teamId: workStation.teamId,
        lineId: workStation.lineId,
        stationId: workStation.stationId,
        taskId: dispatch.taskId,
        fingerprint: dispatch.stationFingerprint,
        config: dispatch.stationConfig,
        briefedTask: dispatch.briefedTask,
        orderedAt: dispatch.orderedAt,
      })
      .from(dispatch)
      .innerJoin(workStation, eq(workStation.stationId, dispatch.stationId))
      .where(
        and(eq(dispatch.id, runId), eq(dispatch.kind, 'task'), ended) as SQL,
      )
      .limit(1);

    if (!row?.taskId) {
      return null;
    }

    const earlier = await this.db
      .select({ runId: dispatch.id, superseded: dispatch.superseded })
      .from(dispatch)
      .where(
        and(
          eq(dispatch.kind, 'task'),
          isNull(dispatch.refused),
          eq(dispatch.taskId, row.taskId),
          eq(dispatch.stationId, row.stationId),
          lt(dispatch.orderedAt, row.orderedAt),
        ),
      );
    const facts = await this.factsOf([
      row.runId,
      ...earlier.map((each) => each.runId),
    ]);
    const run = facts.get(row.runId);

    if (!run?.ended || !run.endedAt) {
      return null;
    }

    const { briefedTask, orderedAt, ...ran } = row;

    return {
      ...ran,
      taskId: row.taskId,
      earlier: earlier.flatMap((each) => {
        const was = facts.get(each.runId);
        return was ? [RunReadingMapper.state(was.state, each.superseded)] : [];
      }),
      harness: run.harness.value,
      reviewing: briefedTask?.reviewing ?? null,
      queuedAt: orderedAt,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
    };
  }

  async unfinishedOfTeam(teamId: TeamId): Promise<readonly UnfinishedRunRow[]> {
    const rows = await this.db
      .select({
        runId: dispatch.id,
        lineId: workStation.lineId,
        stationId: workStation.stationId,
        taskId: task.id,
        openedBy: task.createdById,
        config: dispatch.stationConfig,
        queuedAt: dispatch.orderedAt,
      })
      .from(dispatch)
      .innerJoin(task, eq(task.id, dispatch.taskId))
      .innerJoin(workStation, eq(workStation.stationId, dispatch.stationId))
      .where(
        and(
          eq(dispatch.teamId, teamId.value),
          eq(dispatch.kind, 'task'),
          isNull(dispatch.refused),
          isNull(dispatch.endedAt),
        ),
      )
      .orderBy(desc(dispatch.orderedAt), desc(dispatch.id))
      .limit(MOST_UNFINISHED);
    const facts = await this.factsOf(rows.map((row) => row.runId));

    return rows.flatMap((row) => {
      const run = facts.get(row.runId);

      return run && !run.ended
        ? [
            {
              ...row,
              harness: run.harness.value,
              progress: RunReadingMapper.progress(run.progress),
              startedAt: run.startedAt,
            },
          ]
        : [];
    });
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
    return this.endedWhere(
      and(
        eq(dispatch.kind, 'task'),
        eq(dispatch.stationId, stationId),
        wanted.fingerprint === null
          ? undefined
          : eq(dispatch.stationFingerprint, wanted.fingerprint),
        wanted.since === null
          ? undefined
          : gte(dispatch.orderedAt, wanted.since),
        wanted.until === null ? undefined : lt(dispatch.endedAt, wanted.until),
        wanted.excluding.length === 0
          ? undefined
          : notInArray(dispatch.taskId, [...wanted.excluding]),
      ) as SQL,
      wanted.max,
    );
  }

  async endedAmong(
    stationId: string,
    runIds: readonly string[],
  ): Promise<readonly StationRunRow[]> {
    return runIds.length === 0
      ? []
      : this.endedWhere(
          and(
            inArray(dispatch.id, [...runIds]),
            ne(dispatch.kind, 'chat'),
            eq(dispatch.stationId, stationId),
          ) as SQL,
          null,
        );
  }

  private async endedWhere(
    which: SQL,
    limit: number | null,
  ): Promise<readonly StationRunRow[]> {
    const query = this.db
      .select({
        runId: dispatch.id,
        taskId: task.id,
        title: task.title,
        fingerprint: dispatch.stationFingerprint,
        superseded: dispatch.superseded,
        startedAt: dispatch.orderedAt,
      })
      .from(dispatch)
      .innerJoin(task, eq(task.id, dispatch.taskId))
      .where(and(which, ended))
      .orderBy(desc(dispatch.orderedAt), desc(dispatch.id));
    const rows = await (limit === null ? query : query.limit(limit));
    const facts = await this.factsOf(rows.map((row) => row.runId));

    return rows.flatMap(({ superseded, ...row }) => {
      const run = facts.get(row.runId);

      return run?.ended && run.endedAt
        ? [
            {
              ...row,
              state: RunReadingMapper.state(run.state, superseded),
              attempt: run.attempt,
              harness: run.harness.value,
              endedAt: run.endedAt,
            },
          ]
        : [];
    });
  }

  private async factsOf(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, RunFacts>> {
    const found =
      runIds.length === 0
        ? []
        : await this.facts.of([...new Set(runIds)].map(RunId.of));

    return new Map(found.map((each) => [each.runId.value, each]));
  }

  journalsOf(runIds: readonly string[]): Promise<readonly RunJournal[]> {
    return this.journals.ofRuns(runIds.map(RunId.of));
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
