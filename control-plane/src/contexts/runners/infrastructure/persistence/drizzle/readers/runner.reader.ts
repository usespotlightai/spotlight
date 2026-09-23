import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  RunnerReaderPort,
  RunnerSummary,
} from '@runners/application/ports/runner-reader.port';
import { runner } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleRunnerReader implements RunnerReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async anyOffersWork(workspaceId: WorkspaceId): Promise<boolean> {
    const [offering] = await this.db
      .select({ id: runner.id })
      .from(runner)
      .where(
        and(
          eq(runner.workspaceId, workspaceId.value),
          isNull(runner.revokedAt),
          isNotNull(runner.lastSeenAt),
          sql`jsonb_array_length(${runner.harnesses}) > 0`,
        ),
      )
      .limit(1);

    return offering !== undefined;
  }

  async advertisedModels(
    workspaceId: WorkspaceId,
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const rows = await this.db
      .select({ advertised: runner.advertisedModels })
      .from(runner)
      .where(
        and(
          eq(runner.workspaceId, workspaceId.value),
          isNull(runner.revokedAt),
        ),
      );

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

  async inWorkspace(workspaceId: WorkspaceId): Promise<RunnerSummary[]> {
    const rows = await this.db
      .select({
        id: runner.id,
        name: runner.name,
        harnesses: runner.harnesses,
        revokedAt: runner.revokedAt,
        registeredAt: runner.registeredAt,
        lastSeenAt: runner.lastSeenAt,
      })
      .from(runner)
      .where(eq(runner.workspaceId, workspaceId.value))
      .orderBy(runner.registeredAt);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      harnesses: row.harnesses,
      revokedAt: row.revokedAt,
      registeredAt: row.registeredAt,
      lastSeenAt: row.lastSeenAt,
    }));
  }
}
