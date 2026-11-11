import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  olderThan,
  pageOf,
  sortableTime,
} from '@platform/persistence/drizzle/keyset';
import {
  RUN_FACTS,
  type RunFacts,
  type RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import {
  RUN_PROGRESS,
  type RunProgressPort,
} from '@runs/application/ports/run-progress.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Page, PageRequest } from '@work/application/dto/page.dto';
import { RunReadingMapper } from '@work/application/mappers/run-reading.mapper';
import type {
  RunConfigSummary,
  RunConfigView,
  RunNotesSummary,
  RunReaderPort,
  RunStationSummary,
  TaskRunSummary,
  TeamRunSummary,
} from '@work/application/ports/run-reader.port';
import type { RunsInWorkspace } from '@work/application/ports/viewed-runs';
import { worksOn } from '@work/domain/services/conversations';
import { inThreadAt } from '@work/domain/services/station-thread';
import { takesUpRun } from '@work/domain/services/taking-up';
import {
  progressOfCurrentRun,
  progressOfTaskRun,
} from '@work/domain/value-objects/progress';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import { timeCursorOf } from '@work/infrastructure/persistence/drizzle/readers/page-cursor';
import {
  attachmentsFor,
  attachmentsOf,
  awaitedReviewsFor,
  LATEST_RUN_FIRST,
  reviewsBy,
  stationsPerLine,
  taskRuns,
  trailsFor,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  ne,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const ranAt = alias(workStation, 'ran_at');

type StationRow = {
  stationId: string | null;
  stationName: string | null;
  stationColor: string | null;
  stationPosition: number | null;
  stationLineId: string | null;
};

const stationSummaryOf = (
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

const lastChangeOf = (facts: RunFacts): Date =>
  [
    facts.endedAt,
    facts.suspendedAt,
    facts.startedAt,
    facts.queuedAt,
  ].reduce<Date>(
    (latest, each) => (each && each > latest ? each : latest),
    facts.queuedAt,
  );

@Injectable()
export class DrizzleRunReader implements RunReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
    @Inject(RUN_FACTS) private readonly facts: RunFactsPort,
    @Inject(RUN_PROGRESS) private readonly progress: RunProgressPort,
  ) {}

  async listForTask(
    taskId: TaskId,
  ): Promise<RunsInWorkspace<TaskRunSummary[]> | null> {
    const [owner] = await this.db
      .select({ workspaceId: task.workspaceId })
      .from(task)
      .where(eq(task.id, taskId.value))
      .limit(1);

    if (!owner) {
      return null;
    }

    const runs = await this.taskRunsWhere(
      eq(dispatch.taskId, taskId.value),
      null,
    );

    return {
      workspaceId: WorkspaceId.of(owner.workspaceId),
      found: runs.map(
        ({
          taskId: _task,
          taskTitle: _title,
          taskDescription: _description,
          cursorAt: _cursor,
          ...run
        }) => run,
      ),
    };
  }

  async listForTeam(
    teamId: TeamId,
    page: PageRequest,
  ): Promise<Page<TeamRunSummary>> {
    const before = timeCursorOf(page.before);
    const rows = await this.taskRunsWhere(
      and(
        eq(dispatch.teamId, teamId.value),
        before ? olderThan(dispatch.orderedAt, dispatch.id, before) : undefined,
      ) as SQL,
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
  ): Promise<TeamRunSummary | null> {
    const [found] = await this.taskRunsWhere(
      and(
        eq(dispatch.teamId, teamId.value),
        eq(dispatch.id, runId.value),
      ) as SQL,
      1,
    );

    return found ?? null;
  }

  private async taskRunsWhere(
    narrowedTo: SQL,
    limit: number | null,
  ): Promise<(TeamRunSummary & { readonly cursorAt: string })[]> {
    const query = this.db
      .select({
        id: dispatch.id,
        superseded: dispatch.superseded,
        orderedAt: dispatch.orderedAt,
        taskId: dispatch.taskId,
        taskTitle: task.title,
        taskDescription: task.description,
        currentRunId: task.currentRunId,
        stationId: ranAt.stationId,
        stationName: ranAt.name,
        stationColor: ranAt.color,
        stationPosition: ranAt.position,
        stationLineId: ranAt.lineId,
        cursorAt: sortableTime(dispatch.orderedAt),
      })
      .from(dispatch)
      .innerJoin(task, eq(task.id, dispatch.taskId))
      .leftJoin(ranAt, eq(ranAt.stationId, dispatch.stationId))
      .where(and(taskRuns, narrowedTo))
      .orderBy(desc(dispatch.orderedAt), desc(dispatch.id));
    const rows = await (limit === null ? query : query.limit(limit));
    const taskIds = [
      ...new Set(rows.flatMap((row) => (row.taskId ? [row.taskId] : []))),
    ];

    const [facts, stationCounts, review, awaited] = await Promise.all([
      this.factsOf(rows.map((row) => row.id)),
      stationsPerLine(
        this.db,
        rows.flatMap((row) => (row.stationLineId ? [row.stationLineId] : [])),
      ),
      reviewsBy(this.db, taskIds),
      awaitedReviewsFor(this.db, taskIds),
    ]);

    return rows.flatMap(
      ({ stationLineId, currentRunId, superseded, orderedAt, ...row }) => {
        const run = facts.get(row.id);
        const state = run && RunReadingMapper.state(run.state, superseded);

        return run && state
          ? [
              {
                ...row,
                state,
                progress: progressOfTaskRun(
                  state,
                  RunReadingMapper.reading(run),
                  takesUpRun({
                    holdsRun: row.id === currentRunId,
                    awaitsAPerson:
                      row.taskId !== null && awaited.has(row.taskId),
                  }),
                ),
                attempt: run.attempt,
                exitCode: run.exitCode,
                startedAt: orderedAt,
                updatedAt: lastChangeOf(run),
                endedAt: run.endedAt,
                harness: run.harness.value,
                image: run.image,
                station: stationSummaryOf(
                  { ...row, stationLineId },
                  stationCounts,
                ),
                review: review.get(row.id) ?? null,
              },
            ]
          : [];
      },
    );
  }

  private async factsOf(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, RunFacts>> {
    const found =
      runIds.length === 0 ? [] : await this.facts.of(runIds.map(RunId.of));

    return new Map(found.map((each) => [each.runId.value, each]));
  }

  async notesFor(
    runId: RunId,
  ): Promise<RunsInWorkspace<RunNotesSummary> | null> {
    const [found] = await this.db
      .select({
        runId: dispatch.id,
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
        dispatchedAt: dispatch.stationId,
        workspaceId: dispatch.workspaceId,
      })
      .from(dispatch)
      .innerJoin(task, eq(task.id, dispatch.taskId))
      .leftJoin(ranAt, eq(ranAt.stationId, dispatch.stationId))
      .where(and(taskRuns, eq(dispatch.id, runId.value)))
      .limit(1);

    if (!found?.dispatchedAt) {
      return null;
    }

    const [latest] = await this.db
      .select({ runId: dispatch.id, superseded: dispatch.superseded })
      .from(dispatch)
      .where(
        and(
          taskRuns,
          eq(dispatch.taskId, found.taskId),
          eq(dispatch.stationId, found.dispatchedAt),
        ),
      )
      .orderBy(...LATEST_RUN_FIRST)
      .limit(1);
    const latestId = latest?.runId ?? found.runId;
    const progress = new Map(
      (
        await this.progress.progressOf(
          [...new Set([found.runId, latestId])].map(RunId.of),
        )
      ).map((each) => [each.runId.value, each]),
    );
    const ran = progress.get(found.runId);
    const latestRun = progress.get(latestId) ?? ran;

    if (!ran || !latestRun) {
      return null;
    }

    const [trails, attached, stationCounts] = await Promise.all([
      trailsFor(this.db, this.people, [found.taskId]),
      attachmentsFor(this.db, [found.taskId]),
      stationsPerLine(this.db, [found.stationLineId ?? '']),
    ]);
    const notes = trails.get(found.taskId) ?? [];

    return {
      workspaceId: WorkspaceId.of(found.workspaceId),
      found: {
        runId: found.runId,
        taskId: found.taskId,
        title: found.title,
        description: found.description,
        attachments: attachmentsOf(attached, found.taskId).own,
        station: stationSummaryOf({ ...found }, stationCounts),
        createdAt: found.createdAt,
        briefing: found.briefing ?? '',
        progress: worksOn(found.workingRunId === latestRun.runId.value, notes)
          ? progressOfCurrentRun(RunReadingMapper.reading(latestRun), true)
          : null,
        latestRun: {
          id: latestRun.runId.value,
          state: RunReadingMapper.state(
            latestRun.state,
            latest?.superseded ?? false,
          ),
          progress: RunReadingMapper.progress(latestRun.progress),
        },
        notes: notes.filter((note) =>
          inThreadAt(
            {
              runId: note.runId ? RunId.of(note.runId) : null,
              stationId: StationId.of(note.stationId),
            },
            found.stationId ? StationId.of(found.stationId) : null,
            runId,
          ),
        ),
      },
    };
  }

  async configFor(
    runId: RunId,
  ): Promise<RunsInWorkspace<RunConfigSummary> | null> {
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

    if (!found) {
      return null;
    }

    const workspaceId = WorkspaceId.of(found.workspaceId);
    const ran =
      found.fingerprint && found.parts
        ? {
            runId: found.runId,
            fingerprint: found.fingerprint,
            parts: found.parts,
          }
        : null;

    if (!ran || !found.stationId || found.kind !== 'task') {
      return { workspaceId, found: { ran, before: null } };
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
      workspaceId,
      found: { ran, before: earlier ? configured(earlier) : null },
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
