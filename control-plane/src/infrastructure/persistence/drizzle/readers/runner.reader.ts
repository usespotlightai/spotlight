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
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

@Injectable()
export class DrizzleRunnerReader implements RunnerReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async anyConnected(): Promise<boolean> {
    const [reached] = await this.db
      .select({ id: runner.id })
      .from(runner)
      .where(and(isNull(runner.revokedAt), isNotNull(runner.lastSeenAt)))
      .limit(1);

    return reached !== undefined;
  }

  async advertisedModels(): Promise<ReadonlyMap<string, readonly string[]>> {
    const rows = await this.db
      .select({ advertised: runner.advertisedModels })
      .from(runner)
      .where(isNull(runner.revokedAt));

    const byHarness = new Map<string, string[]>();

    for (const row of rows) {
      for (const [harness, models] of Object.entries(row.advertised)) {
        const held = byHarness.get(harness) ?? [];

        for (const model of models) {
          if (!held.includes(model)) {
            held.push(model);
          }
        }
        byHarness.set(harness, held);
      }
    }

    return byHarness;
  }

  async listAll(): Promise<RunnerSummary[]> {
    const rows = await this.db
      .select({
        id: runner.id,
        name: runner.name,
        harnesses: runner.harnesses,
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
      .orderBy(runner.registeredAt);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      harnesses: row.harnesses,
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
