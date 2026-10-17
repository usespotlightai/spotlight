import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  ConnectionOfRun,
  RecordedConnection,
  RunConnectionsPort,
} from '@work/application/ports/run-connections.port';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import {
  AUTH_FAILED_STATUSES,
  RunConnection,
  SERVER_ERROR,
  STOPPED_OUTCOMES,
} from '@work/domain/value-objects/run-connection.vo';
import { runConnection } from '@work/infrastructure/persistence/drizzle/schemas/run-connection.schema';
import {
  and,
  asc,
  eq,
  getTableColumns,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';

export const MAX_ERRORS_PER_RUN = 500;

const isError = or(
  inArray(runConnection.outcome, [...STOPPED_OUTCOMES]),
  and(
    eq(runConnection.outcome, 'injected'),
    or(
      inArray(runConnection.status, [...AUTH_FAILED_STATUSES]),
      gte(runConnection.status, SERVER_ERROR),
    ),
  ),
);

@Injectable()
export class DrizzleRunConnections implements RunConnectionsPort {
  constructor(private readonly context: DrizzleContext) {}

  async record(
    attempt: RunAttempt,
    connections: readonly RunConnection[],
  ): Promise<void> {
    if (connections.length === 0) {
      return;
    }

    await this.context.db.insert(runConnection).values(
      connections.map((each) => ({
        runId: attempt.runId.value,
        attempt: attempt.number,
        host: each.host,
        port: each.port,
        bytesOut: each.bytesOut,
        bytesIn: each.bytesIn,
        ms: each.ms,
        outcome: each.outcome,
        status: each.status,
        reason: each.reason,
        at: each.at,
      })),
    );
  }

  async of(runId: string): Promise<readonly RecordedConnection[]> {
    const rows = await this.context.db
      .select()
      .from(runConnection)
      .where(eq(runConnection.runId, runId))
      .orderBy(asc(runConnection.at), asc(runConnection.id));

    return rows.map((row) => ({
      attempt: row.attempt,
      connection: RunConnection.of(row),
    }));
  }

  async errorsIn(
    runIds: readonly string[],
  ): Promise<readonly ConnectionOfRun[]> {
    if (runIds.length === 0) {
      return [];
    }

    const ranked = this.context.db.$with('ranked').as(
      this.context.db
        .select({
          ...getTableColumns(runConnection),
          place:
            sql<number>`row_number() over (partition by ${runConnection.runId} order by ${runConnection.at}, ${runConnection.id})`.as(
              'place',
            ),
        })
        .from(runConnection)
        .where(and(inArray(runConnection.runId, [...runIds]), isError)),
    );

    const rows = await this.context.db
      .with(ranked)
      .select()
      .from(ranked)
      .where(lte(ranked.place, MAX_ERRORS_PER_RUN))
      .orderBy(asc(ranked.at), asc(ranked.id));

    return rows.map((row) => ({
      runId: row.runId,
      attempt: row.attempt,
      connection: RunConnection.of(row),
    }));
  }

  async forgetBefore(before: Date, max: number): Promise<number> {
    const doomed = this.context.db
      .select({ id: runConnection.id })
      .from(runConnection)
      .where(lt(runConnection.at, before))
      .limit(max);
    const forgotten = await this.context.db
      .delete(runConnection)
      .where(inArray(runConnection.id, doomed))
      .returning({ id: runConnection.id });

    return forgotten.length;
  }
}
