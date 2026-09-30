import { Injectable } from '@nestjs/common';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { RunRecordMovedOnError } from '@outcomes/domain/exceptions/run-record-moved-on.error';
import type {
  RunRecordRepository,
  StationRecords,
} from '@outcomes/domain/repositories/run-record.repository';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { runRecord } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, inArray, isNotNull, lte, ne } from 'drizzle-orm';

type RecordRow = typeof runRecord.$inferSelect;

const endOf = (row: RecordRow): RunEnd | null => {
  if (!row.endedAt) {
    return null;
  }
  if (
    !row.teamId ||
    !row.lineId ||
    !row.stationId ||
    !row.taskId ||
    !row.ending ||
    row.round === null
  ) {
    throw new InconsistentStateError(
      'run record',
      'ended without saying where, how, or in which round',
    );
  }

  return RunEnd.of({
    place: RunPlace.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
      taskId: TaskId.of(row.taskId),
    }),
    fingerprint: row.fingerprint,
    endedAt: row.endedAt,
    ending: row.ending,
    failure: row.failure,
    round: row.round,
  });
};

const nextOf = (row: RecordRow): NextAct | null => {
  if ((row.nextAct === null) !== (row.nextAt === null)) {
    throw new InconsistentStateError(
      'run record',
      'was acted on without saying when, or says when without the act',
    );
  }

  return row.nextAct && row.nextAt ? NextAct.of(row.nextAct, row.nextAt) : null;
};

const toRecord = (row: RecordRow): RunRecord =>
  RunRecord.rehydrate({
    runId: RunId.of(row.runId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    end: endOf(row),
    superseded: row.superseded,
    checks: row.checks,
    next: nextOf(row),
    version: row.version,
  });

const columnsOf = (record: RunRecord) => {
  const end = record.end;

  return {
    teamId: end?.place.teamId.value ?? null,
    lineId: end?.place.lineId ?? null,
    stationId: end?.place.stationId ?? null,
    taskId: record.taskId?.value ?? null,
    fingerprint: end?.fingerprint ?? null,
    endedAt: end?.endedAt ?? null,
    ending: end?.ending ?? null,
    failure: end?.failure ?? null,
    round: end?.round ?? null,
    superseded: record.superseded,
    checks: record.checks,
    nextAct: record.next?.act ?? null,
    nextAt: record.next?.at ?? null,
  };
};

@Injectable()
export class DrizzleRunRecordRepository implements RunRecordRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: RunRecord): Promise<void> {
    const written = await this.context.db
      .insert(runRecord)
      .values({
        runId: added.runId.value,
        workspaceId: added.workspaceId.value,
        version: added.version,
        ...columnsOf(added),
      })
      .onConflictDoNothing({ target: runRecord.runId })
      .returning({ runId: runRecord.runId });

    if (written.length === 0) {
      throw new RunRecordMovedOnError(added.runId.value);
    }
  }

  async save(saved: RunRecord): Promise<void> {
    const written = await this.context.db
      .update(runRecord)
      .set({ version: saved.version + 1, ...columnsOf(saved) })
      .where(
        and(
          eq(runRecord.runId, saved.runId.value),
          eq(runRecord.version, saved.version),
        ),
      )
      .returning({ runId: runRecord.runId });

    if (written.length === 0) {
      throw new RunRecordMovedOnError(saved.runId.value);
    }
  }

  async of(runId: RunId): Promise<RunRecord | null> {
    const [row] = await this.context.db
      .select()
      .from(runRecord)
      .where(eq(runRecord.runId, runId.value))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async ofRuns(runIds: readonly RunId[]): Promise<readonly RunRecord[]> {
    if (runIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(
        inArray(
          runRecord.runId,
          runIds.map((each) => each.value),
        ),
      );

    return rows.map(toRecord);
  }

  async lastEndedOfTaskAt(
    taskId: TaskId,
    stationId: string,
    by: Date,
  ): Promise<RunRecord | null> {
    const [row] = await this.context.db
      .select()
      .from(runRecord)
      .where(
        and(
          eq(runRecord.taskId, taskId.value),
          eq(runRecord.stationId, stationId),
          ne(runRecord.ending, 'withdrawn'),
          lte(runRecord.endedAt, by),
        ),
      )
      .orderBy(desc(runRecord.endedAt))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async lastAtStation(criteria: StationRecords): Promise<readonly RunRecord[]> {
    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(
        and(
          eq(runRecord.workspaceId, criteria.workspaceId.value),
          eq(runRecord.teamId, criteria.teamId.value),
          eq(runRecord.stationId, criteria.stationId),
          criteria.lineId === null
            ? undefined
            : eq(runRecord.lineId, criteria.lineId),
          isNotNull(runRecord.endedAt),
        ),
      )
      .orderBy(desc(runRecord.endedAt))
      .limit(criteria.last);

    return rows.map(toRecord);
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(runRecord)
      .where(eq(runRecord.taskId, taskId.value));
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(runRecord)
      .where(
        and(
          eq(runRecord.workspaceId, workspaceId.value),
          eq(runRecord.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(runRecord)
      .where(eq(runRecord.workspaceId, workspaceId.value));
  }
}
