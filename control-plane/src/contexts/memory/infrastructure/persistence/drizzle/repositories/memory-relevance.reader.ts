import type { MemoryRelevancePort } from '@memory/application/ports/memory-relevance.port';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import { standingWhen } from '@memory/infrastructure/persistence/drizzle/repositories/memory.repository';
import { memory } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleMemoryRelevance implements MemoryRelevancePort {
  constructor(private readonly context: DrizzleContext) {}

  async rank(
    memories: readonly MemoryId[],
    words: string,
  ): Promise<ReadonlyMap<string, number>> {
    if (memories.length === 0 || !words.trim()) {
      return new Map();
    }

    const document = sql`to_tsvector('english', ${memory.body})`;
    const anyOf = sql`nullif(replace(plainto_tsquery('english', ${words})::text, '&', '|'), '')::tsquery`;
    const rows = await this.context.db
      .select({
        id: memory.id,
        rank: sql<number>`ts_rank(${document}, ${anyOf})`,
      })
      .from(memory)
      .where(
        and(
          inArray(
            memory.id,
            memories.map((each) => each.value),
          ),
          sql`${document} @@ ${anyOf}`,
        ),
      );

    return new Map(rows.map((row) => [row.id, Number(row.rank)]));
  }

  async recall(
    teamId: TeamId,
    words: RecallWords,
    most: number,
    standingAt: Date | null = null,
  ): Promise<readonly MemoryId[]> {
    const document = sql`to_tsvector('english', ${memory.body})`;
    const asked = sql`websearch_to_tsquery('english', ${words.value})`;
    const rows = await this.context.db
      .select({ id: memory.id })
      .from(memory)
      .where(
        and(
          eq(memory.teamId, teamId.value),
          standingWhen(standingAt),
          sql`${document} @@ ${asked}`,
        ),
      )
      .orderBy(
        desc(sql`ts_rank(${document}, ${asked})`),
        desc(memory.approvedAt),
      )
      .limit(most);

    return rows.map((row) => MemoryId.of(row.id));
  }
}
