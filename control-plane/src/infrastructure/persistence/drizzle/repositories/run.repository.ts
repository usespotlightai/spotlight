import { Run } from '@domain/aggregates/run.aggregate';
import type {
  RunEventRecord,
  RunRepository,
} from '@domain/repositories/run.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import type { RunState } from '@domain/value-objects/run-state';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  run,
  runEvent,
} from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { Injectable } from '@nestjs/common';
import { and, eq, lte, sql } from 'drizzle-orm';

type Row = typeof run.$inferSelect;

@Injectable()
export class DrizzleRunRepository implements RunRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Run): Promise<void> {
    await this.context.db.insert(run).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      pool: added.pool,
      state: added.state,
      spec: added.spec,
    });
  }

  /**
   * Picking which row is the database's problem: `FOR UPDATE SKIP LOCKED` is
   * how two runners asking at the same moment cannot both win, and the second
   * takes the next run rather than queueing behind one it will never get.
   *
   * What being claimed *means* is not decided here. The row is locked, handed
   * to the aggregate, and whatever it makes of itself is written back inside
   * the same transaction.
   */
  async claimNext(pool: string, by: RunnerId, now: Date): Promise<Run | null> {
    return this.context.run(async () => {
      const locked = await this.context.db.execute<Row>(sql`
        SELECT
          id,
          workspace_id      AS "workspaceId",
          pool,
          state,
          spec,
          claimed_by        AS "claimedBy",
          lease_expires_at  AS "leaseExpiresAt",
          exit_code         AS "exitCode",
          message,
          attempt
        FROM ${run}
        WHERE pool = ${pool} AND state = 'queued'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);

      const [row] = locked.rows;
      if (!row) {
        return null;
      }

      const claiming = toRun(row);
      claiming.claim(by, now);
      await this.save(claiming);

      return claiming;
    });
  }

  async findById(id: RunId): Promise<Run | null> {
    const [row] = await this.context.db
      .select()
      .from(run)
      .where(eq(run.id, id.value))
      .limit(1);

    return row ? toRun(row) : null;
  }

  async save(saved: Run): Promise<void> {
    await this.context.db
      .update(run)
      .set({
        state: saved.state,
        attempt: saved.attempt,
        claimedBy: saved.claimedBy?.value ?? null,
        leaseExpiresAt: saved.leaseExpiresAt,
        exitCode: saved.result?.exitCode ?? null,
        message: saved.result?.message ?? null,
      })
      .where(eq(run.id, saved.id.value));
  }

  async appendEvents(
    id: RunId,
    attempt: number,
    events: readonly RunEventRecord[],
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.context.db
      .insert(runEvent)
      .values(
        events.map((event) => ({
          runId: id.value,
          attempt,
          seq: event.seq,
          type: event.type,
          at: event.at,
          message: event.message ?? null,
          data: event.data ?? null,
          offset: event.offset ?? null,
        })),
      )
      // A runner that retried a batch it had already delivered should not
      // double the journal; the sequence it assigned says which is which.
      .onConflictDoNothing();
  }

  /**
   * Finds the runs whose lease has lapsed and lets each one requeue itself.
   * The query narrows the candidates; `Run.lapsed` decides, so there is one
   * statement of the rule rather than a second opinion in SQL.
   */
  async requeueLapsed(now: Date): Promise<number> {
    return this.context.run(async () => {
      const candidates = await this.context.db
        .select()
        .from(run)
        .where(and(eq(run.state, 'claimed'), lte(run.leaseExpiresAt, now)));

      let requeued = 0;
      for (const row of candidates) {
        const lapsing = toRun(row);
        if (!lapsing.lapsed(now)) {
          continue;
        }

        lapsing.requeue(now);
        await this.save(lapsing);
        requeued += 1;
      }

      return requeued;
    });
  }
}

/**
 * A raw statement bypasses the ORM's own conversion, and drizzle's pg type
 * parsers hand back timestamps as strings. The typed query path returns Dates,
 * so this has to cope with both.
 */
const asDate = (value: Date | string | null): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
};

const toRun = (row: Row): Run =>
  Run.rehydrate({
    id: RunId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    pool: row.pool,
    spec: row.spec,
    state: row.state as RunState,
    claimedBy: row.claimedBy ? RunnerId.of(row.claimedBy) : null,
    leaseExpiresAt: asDate(row.leaseExpiresAt),
    outcome:
      row.exitCode === null
        ? null
        : {
            exitCode: row.exitCode,
            failed: row.state === 'failed',
            message: row.message ?? undefined,
          },
    attempt: row.attempt ?? 1,
  });
