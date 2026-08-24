import type {
  RunnerReaderPort,
  RunnerSummary,
} from '@application/ports/runner-reader.port';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  run,
  runner,
} from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleRunnerReader implements RunnerReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listAll(): Promise<RunnerSummary[]> {
    const rows = await this.db
      .select({
        id: runner.id,
        alias: runner.alias,
        pool: runner.pool,
        revokedAt: runner.revokedAt,
        registeredAt: runner.registeredAt,
        lastSeenAt: runner.lastSeenAt,
        runId: run.id,
        runState: run.state,
      })
      .from(runner)
      .leftJoin(
        run,
        and(eq(run.claimedBy, runner.id), eq(run.state, 'claimed')),
      )
      .orderBy(runner.pool, runner.registeredAt);

    return rows.map((row) => ({
      id: row.id,
      alias: row.alias,
      pool: row.pool,
      revokedAt: row.revokedAt,
      registeredAt: row.registeredAt,
      lastSeenAt: row.lastSeenAt,
      currentRun: row.runId
        ? {
            id: row.runId,
            state: row.runState ?? 'claimed',
          }
        : null,
    }));
  }
}
