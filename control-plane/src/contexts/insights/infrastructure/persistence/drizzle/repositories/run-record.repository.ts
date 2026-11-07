import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { RunRecordVersionConflictError } from '@insights/domain/exceptions/run-record-version-conflict.error';
import type {
  RecordsOwner,
  RunRecordRepository,
} from '@insights/domain/repositories/run-record.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import {
  dismissalsOf,
  endOf,
  firstHumanActionOf,
  memoriesOf,
  partColumnsOf,
  passOf,
  toolsOf,
  usageOf,
} from '@insights/infrastructure/persistence/drizzle/mappers/run-parts.mapper';
import { runRecord } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, desc, eq, gt, gte, inArray, lte, ne } from 'drizzle-orm';

type RecordRow = typeof runRecord.$inferSelect;

const toRecord = (row: RecordRow): RunRecord =>
  RunRecord.rehydrate({
    runId: RunId.of(row.runId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    end: endOf(row),
    supersededAt: row.supersededAt,
    checks: row.checks,
    checkedAt: row.checkedAt,
    firstHumanAction: firstHumanActionOf(row),
    approvalAnsweredAt: row.approvalAnsweredAt,
    usage: usageOf(row),
    passed: passOf(row),
    tools: toolsOf(row),
    dismissals: dismissalsOf(row),
    memories: memoriesOf(row),
    version: row.version,
  });

@Injectable()
export class DrizzleRunRecordRepository implements RunRecordRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: RunRecord): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(runRecord)
        .values({
          runId: added.runId.value,
          workspaceId: added.workspaceId.value,
          version: added.version,
          ...partColumnsOf(added),
        })
        .onConflictDoNothing({ target: runRecord.runId })
        .returning({ runId: runRecord.runId });

      if (written.length === 0) {
        throw new RunRecordVersionConflictError(added.runId.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: RunRecord): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(runRecord)
        .set({ version: saved.version + 1, ...partColumnsOf(saved) })
        .where(
          and(
            eq(runRecord.runId, saved.runId.value),
            eq(runRecord.version, saved.version),
          ),
        )
        .returning({ runId: runRecord.runId });

      if (written.length === 0) {
        throw new RunRecordVersionConflictError(saved.runId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
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
        inList(
          runRecord.runId,
          runIds.map((each) => each.value),
        ),
      );

    return rows.map(toRecord);
  }

  async ofTasks(taskIds: readonly TaskId[]): Promise<readonly RunRecord[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(
        inArray(
          runRecord.taskId,
          taskIds.map((each) => each.value),
        ),
      );

    return rows.map(toRecord);
  }

  async lastEndedOfTaskAt(
    taskId: TaskId,
    stationId: StationId,
    by: Date,
  ): Promise<RunRecord | null> {
    const [row] = await this.context.db
      .select()
      .from(runRecord)
      .where(
        and(
          eq(runRecord.taskId, taskId.value),
          eq(runRecord.stationId, stationId.value),
          ne(runRecord.ending, 'cancelled'),
          lte(runRecord.endedAt, by),
        ),
      )
      .orderBy(desc(runRecord.endedAt))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async runIdsOf(
    owner: RecordsOwner,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunId[]> {
    const rows = await this.context.db
      .select({ runId: runRecord.runId })
      .from(runRecord)
      .where(
        and(
          eq(runRecord.workspaceId, owner.workspaceId.value),
          owner.teamId ? eq(runRecord.teamId, owner.teamId.value) : undefined,
          after ? gt(runRecord.runId, after.value) : undefined,
        ),
      )
      .orderBy(asc(runRecord.runId))
      .limit(max);

    return rows.map((each) => RunId.of(each.runId));
  }

  async endedSince(
    since: Date,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunRecord[]> {
    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(
        and(
          gte(runRecord.endedAt, since),
          after ? gt(runRecord.runId, after.value) : undefined,
        ),
      )
      .orderBy(asc(runRecord.runId))
      .limit(max);

    return rows.map(toRecord);
  }

  async remove(removed: RunRecord): Promise<void> {
    await this.context.inTransaction(async () => {
      const gone = await this.context.db
        .delete(runRecord)
        .where(
          and(
            eq(runRecord.runId, removed.runId.value),
            eq(runRecord.version, removed.version),
          ),
        )
        .returning({ runId: runRecord.runId });

      if (gone.length === 0) {
        throw new RunRecordVersionConflictError(removed.runId.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly RunRecord[]> {
    const rows = await this.context.db
      .select()
      .from(runRecord)
      .where(inScope(runRecord, scope))
      .limit(max);

    return rows.map(toRecord);
  }
}
