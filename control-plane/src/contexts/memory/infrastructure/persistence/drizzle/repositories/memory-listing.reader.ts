import type {
  MemoryCriteria,
  MemoryListingPort,
} from '@memory/application/ports/memory-listing.port';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { memory } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, desc, eq, sql } from 'drizzle-orm';

const MAX_LISTED = 500;

@Injectable()
export class DrizzleMemoryListing implements MemoryListingPort {
  constructor(private readonly context: DrizzleContext) {}

  async listed(
    teamId: TeamId,
    criteria: MemoryCriteria,
  ): Promise<readonly MemoryId[]> {
    const rows = await this.context.db
      .select({ id: memory.id })
      .from(memory)
      .where(
        and(
          eq(memory.teamId, teamId.value),
          eq(memory.status, criteria.status),
          criteria.kind ? eq(memory.kind, criteria.kind) : undefined,
          criteria.lineId ? eq(memory.lineId, criteria.lineId) : undefined,
          criteria.stationId
            ? eq(memory.stationId, criteria.stationId)
            : undefined,
          criteria.repository
            ? eq(memory.repository, criteria.repository)
            : undefined,
          criteria.path
            ? sql`exists (select 1 from jsonb_array_elements_text(${memory.paths}) as entry(path) where starts_with(entry.path, ${criteria.path}))`
            : undefined,
        ),
      )
      .orderBy(
        criteria.status === 'retired'
          ? desc(memory.retiredAt)
          : desc(memory.approvedAt),
      )
      .limit(MAX_LISTED);

    return rows.map((row) => MemoryId.of(row.id));
  }
}
