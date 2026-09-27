import type {
  MemoryUsesPort,
  UsedMemory,
} from '@memory/application/ports/memory-uses.port';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import { memoryUse } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { and, asc, countDistinct, eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleMemoryUses implements MemoryUsesPort {
  constructor(private readonly context: DrizzleContext) {}

  async record(
    runId: RunId,
    way: MemoryUse,
    memories: readonly MemoryId[],
    at: Date,
  ): Promise<void> {
    if (memories.length === 0) {
      return;
    }

    await this.context.db
      .insert(memoryUse)
      .values(
        memories.map((each) => ({
          memoryId: each.value,
          runId: runId.value,
          way,
          at,
        })),
      )
      .onConflictDoNothing();
  }

  async ofRun(runId: RunId): Promise<readonly UsedMemory[]> {
    const rows = await this.context.db
      .select({ memoryId: memoryUse.memoryId, way: memoryUse.way })
      .from(memoryUse)
      .where(eq(memoryUse.runId, runId.value))
      .orderBy(asc(memoryUse.at));

    return rows.map((row) => ({
      memoryId: MemoryId.of(row.memoryId),
      way: row.way,
    }));
  }

  async runsUsing(
    memories: readonly MemoryId[],
    way?: MemoryUse,
  ): Promise<ReadonlyMap<string, number>> {
    if (memories.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select({
        memoryId: memoryUse.memoryId,
        runs: countDistinct(memoryUse.runId),
      })
      .from(memoryUse)
      .where(
        and(
          inArray(
            memoryUse.memoryId,
            memories.map((each) => each.value),
          ),
          way ? eq(memoryUse.way, way) : undefined,
        ),
      )
      .groupBy(memoryUse.memoryId);

    return new Map(rows.map((row) => [row.memoryId, Number(row.runs)]));
  }
}
