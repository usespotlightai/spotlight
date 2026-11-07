import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunConnectionLedgerPort } from '@runs/application/ports/run-connection-ledger.port';
import type {
  ConnectionOfRun,
  RecordedConnection,
  RunConnectionContract,
  RunConnectionsPort,
} from '@runs/application/ports/run-connections.port';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunConnection } from '@runs/domain/value-objects/run-connection.vo';
import { runConnection } from '@runs/infrastructure/persistence/drizzle/schemas/run-connection.schema';
import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  lt,
  lte,
  sql,
} from 'drizzle-orm';

export const MAX_ERRORS_PER_RUN = 500;

const contractOf = (connection: RunConnection): RunConnectionContract => ({
  host: connection.host,
  port: connection.port,
  bytesOut: connection.bytesOut,
  bytesIn: connection.bytesIn,
  ms: connection.ms,
  outcome: connection.outcome,
  status: connection.status,
  reason: connection.reason,
  error: connection.error,
  at: connection.at,
});

@Injectable()
export class DrizzleRunConnections
  implements RunConnectionsPort, RunConnectionLedgerPort
{
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
        error: each.error,
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
      connection: contractOf(RunConnection.of(row)),
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
        .where(
          and(
            inArray(runConnection.runId, [...runIds]),
            isNotNull(runConnection.error),
          ),
        ),
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
      connection: contractOf(RunConnection.of(row)),
    }));
  }

  async purgeBefore(before: Date, max: number): Promise<number> {
    const doomed = this.context.db
      .select({ id: runConnection.id })
      .from(runConnection)
      .where(lt(runConnection.at, before))
      .limit(max);
    const purged = await this.context.db
      .delete(runConnection)
      .where(inArray(runConnection.id, doomed))
      .returning({ id: runConnection.id });

    return purged.length;
  }
}
