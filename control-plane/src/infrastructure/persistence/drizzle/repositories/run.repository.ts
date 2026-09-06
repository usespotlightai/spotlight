import { Run } from '@domain/aggregates/run.aggregate';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import type {
  RunEventRecord,
  RunRepository,
} from '@domain/repositories/run.repository';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunOutcome } from '@domain/value-objects/run-outcome.vo';
import { RunPriority } from '@domain/value-objects/run-priority.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  run,
  runEvent,
} from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { Injectable } from '@nestjs/common';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';

type Row = typeof run.$inferSelect;

@Injectable()
export class DrizzleRunRepository implements RunRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Run): Promise<void> {
    await this.context.db.insert(run).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      harness: added.harness.value,
      priority: added.priority.value,
      taskId: added.taskId?.value ?? null,
      stationId: added.stationId?.value ?? null,
      state: added.state,
      spec: added.spec.value,
      targetRunnerId: added.targetRunner?.value ?? null,
    });
  }

  /**
   * Which row to pick is left to the database. `FOR UPDATE SKIP LOCKED` stops
   * two runners asking at the same moment from both winning, and sends the
   * second to the next run instead of queueing behind one it will never get.
   *
   * What being claimed means is decided by the aggregate: the row is locked,
   * handed over, and written back in the same transaction.
   */
  /** A run wanting a harness no runner reported having simply waits. */
  async claimNext(
    harnesses: readonly HarnessId[],
    by: RunnerId,
    now: Date,
  ): Promise<Run | null> {
    if (harnesses.length === 0) {
      return null;
    }

    const named = harnesses.map((harness) => harness.value);

    return this.context.run(async () => {
      const locked = await this.context.db.execute<Row>(sql`
        SELECT
          id,
          workspace_id      AS "workspaceId",
          harness,
          priority,
          task_id           AS "taskId",
          state,
          spec,
          target_runner_id  AS "targetRunnerId",
          claimed_by        AS "claimedBy",
          lease_expires_at  AS "leaseExpiresAt",
          exit_code         AS "exitCode",
          message,
          attempt
        FROM ${run}
        WHERE ${inArray(run.harness, named)}
          AND state = 'queued'
          AND (target_runner_id IS NULL OR target_runner_id = ${by.value})
        -- The order work is handed out in: the station nearest the front of
        -- the line first, and among equals the one that has waited longest.
        -- Said in SQL because the claim must be one statement.
        ORDER BY priority DESC, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);

      const [row] = locked.rows;
      if (!row) {
        return null;
      }

      const claimed = toRun(row).claim(by, now);
      await this.save(claimed);

      return claimed;
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

  async releaseClaimedBy(runner: RunnerId): Promise<void> {
    await this.context.run(async () => {
      const held = await this.context.db
        .select()
        .from(run)
        .where(and(eq(run.state, 'claimed'), eq(run.claimedBy, runner.value)));

      for (const row of held) {
        await this.save(toRun(row).release());
      }
    });
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
      // A retried batch must not double the journal. The sequence the runner
      // assigned says which is which.
      .onConflictDoNothing();
  }

  /**
   * Finds the runs whose lease has lapsed and lets each one requeue itself.
   * The query narrows the candidates and `Run.lapsed` decides, so the rule is
   * stated once instead of twice.
   */
  async requeueLapsed(now: Date): Promise<Run[]> {
    return this.context.run(async () => {
      const candidates = await this.context.db
        .select()
        .from(run)
        .where(and(eq(run.state, 'claimed'), lte(run.leaseExpiresAt, now)));

      const givenUp: Run[] = [];

      for (const row of candidates) {
        const lapsing = toRun(row);
        if (!lapsing.lapsed(now)) {
          continue;
        }

        const requeued = lapsing.requeue(now);
        await this.save(requeued);
        givenUp.push(requeued);
      }

      return givenUp;
    });
  }
}

/**
 * A raw statement bypasses the ORM's conversion and drizzle's pg parsers hand
 * back timestamps as strings, while the typed query path returns Dates. This
 * copes with both.
 */
const asDate = (value: Date | string | null): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
};

const specOf = (row: Row): RunSpec => {
  const spec = RunSpec.from(row.spec);

  if (!spec) {
    throw new InconsistentStateError(
      'run',
      `has a spec that no longer reads (${row.id})`,
    );
  }

  return spec;
};

const toRun = (row: Row): Run =>
  Run.rehydrate({
    id: RunId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    harness: HarnessId.of(row.harness),
    priority: RunPriority.of(row.priority),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    stationId: row.stationId ? StationId.of(row.stationId) : null,
    spec: specOf(row),
    targetRunner: row.targetRunnerId ? RunnerId.of(row.targetRunnerId) : null,
    state: row.state,
    claimedBy: row.claimedBy ? RunnerId.of(row.claimedBy) : null,
    leaseExpiresAt: asDate(row.leaseExpiresAt),
    result:
      row.exitCode === null
        ? null
        : RunOutcome.of({
            exitCode: row.exitCode,
            failed: row.state === 'failed',
            message: row.message,
          }),
    attempt: row.attempt ?? 1,
  });
