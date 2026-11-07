import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { RecordedMemoryUses } from '@memory/domain/entities/recorded-memory-uses.entity';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import { memoryUse } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { and, asc, countDistinct, eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleMemoryUses implements MemoryUsesPort {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async record(uses: RecordedMemoryUses): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .insert(memoryUse)
        .values(
          uses.memories.map((each) => ({
            memoryId: each.value,
            runId: uses.runId.value,
            via: uses.via,
            at: uses.at,
          })),
        )
        .onConflictDoNothing();
      await this.events.dispatch(uses.pullEvents());
    });
  }

  async usedBy(runId: RunId, via: MemoryUse): Promise<readonly MemoryId[]> {
    const rows = await this.context.db
      .select({ memoryId: memoryUse.memoryId })
      .from(memoryUse)
      .where(and(eq(memoryUse.runId, runId.value), eq(memoryUse.via, via)))
      .orderBy(asc(memoryUse.at));

    return rows.map((row) => MemoryId.of(row.memoryId));
  }

  async runsUsing(
    memories: readonly MemoryId[],
    via?: MemoryUse,
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
          via ? eq(memoryUse.via, via) : undefined,
        ),
      )
      .groupBy(memoryUse.memoryId);

    return new Map(rows.map((row) => [row.memoryId, Number(row.runs)]));
  }
}
