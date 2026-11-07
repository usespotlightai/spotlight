import type { MemoryRelevancePort } from '@memory/application/ports/memory-relevance.port';
import type { BriefingAbout } from '@memory/domain/value-objects/briefing-about.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { RecallWords } from '@memory/domain/value-objects/recall-words.vo';
import { activeAsOf } from '@memory/infrastructure/persistence/drizzle/memory-prefilters';
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
    about: BriefingAbout,
  ): Promise<ReadonlyMap<string, number>> {
    if (memories.length === 0 || about.isEmpty) {
      return new Map();
    }

    const document = sql`to_tsvector('english', ${memory.body})`;
    const anyOf = sql`nullif(replace(plainto_tsquery('english', ${about.value})::text, '&', '|'), '')::tsquery`;
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
    max: number,
    asOf: Date | null = null,
  ): Promise<readonly MemoryId[]> {
    const document = sql`to_tsvector('english', ${memory.body})`;
    const query = sql`websearch_to_tsquery('english', ${words.value})`;
    const rows = await this.context.db
      .select({ id: memory.id })
      .from(memory)
      .where(
        and(
          eq(memory.teamId, teamId.value),
          activeAsOf(asOf),
          sql`${document} @@ ${query}`,
        ),
      )
      .orderBy(
        desc(sql`ts_rank(${document}, ${query})`),
        desc(memory.approvedAt),
      )
      .limit(max);

    return rows.map((row) => MemoryId.of(row.id));
  }
}
