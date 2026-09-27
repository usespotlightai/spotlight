import type {
  KnownMemoriesPort,
  KnownMemory,
  MemoryReach,
} from '@memory/application/ports/known-memories.port';
import {
  memory,
  memoryProposal,
} from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { and, desc, eq, gte, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

const MOST_STANDING = 50;

const MOST_REJECTED = 20;

interface Scoped {
  readonly teamId: PgColumn;
  readonly lineId: PgColumn;
  readonly stationId: PgColumn;
  readonly repository: PgColumn;
}

const within = (table: Scoped, reach: MemoryReach): SQL | undefined => {
  const repositories = reach.repositories.map((each) => each.value);

  return and(
    eq(table.teamId, reach.teamId.value),
    or(isNull(table.lineId), eq(table.lineId, reach.lineId)),
    or(isNull(table.stationId), eq(table.stationId, reach.stationId)),
    repositories.length > 0
      ? or(isNull(table.repository), inArray(table.repository, repositories))
      : isNull(table.repository),
  );
};

@Injectable()
export class DrizzleKnownMemories implements KnownMemoriesPort {
  constructor(private readonly context: DrizzleContext) {}

  standingIn(reach: MemoryReach): Promise<readonly KnownMemory[]> {
    return this.context.db
      .select({ id: memory.id, kind: memory.kind, body: memory.body })
      .from(memory)
      .where(and(within(memory, reach), eq(memory.standing, 'stands')))
      .orderBy(desc(memory.recordedAt))
      .limit(MOST_STANDING);
  }

  rejectedIn(reach: MemoryReach, since: Date): Promise<readonly KnownMemory[]> {
    return this.context.db
      .select({
        id: memoryProposal.id,
        kind: memoryProposal.kind,
        body: memoryProposal.body,
      })
      .from(memoryProposal)
      .where(
        and(
          within(memoryProposal, reach),
          eq(memoryProposal.state, 'rejected'),
          gte(memoryProposal.rejectedAt, since),
        ),
      )
      .orderBy(desc(memoryProposal.rejectedAt))
      .limit(MOST_REJECTED);
  }
}
