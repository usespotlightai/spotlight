import type {
  MemoryUseWindow,
  TeamMemoryUse,
  TeamMemoryUsePort,
} from '@memory/application/ports/team-memory-use.port';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryRetirement } from '@memory/domain/value-objects/memory-retirement.vo';
import { memory } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, count, desc, eq, gte, lt } from 'drizzle-orm';

@Injectable()
export class DrizzleTeamMemoryUse implements TeamMemoryUsePort {
  constructor(private readonly context: DrizzleContext) {}

  async between(window: MemoryUseWindow): Promise<TeamMemoryUse> {
    const ofTeam = and(
      eq(memory.workspaceId, window.workspaceId),
      eq(memory.teamId, window.teamId),
    );
    const [active] = await this.context.db
      .select({ memories: count() })
      .from(memory)
      .where(and(ofTeam, eq(memory.status, 'active')));

    const retired = await this.context.db
      .select({
        memoryId: memory.id,
        handle: memory.handle,
        body: memory.body,
        reason: memory.retireReason,
        by: memory.retiredBy,
        at: memory.retiredAt,
        supersededBy: memory.supersededBy,
      })
      .from(memory)
      .where(
        and(
          ofTeam,
          gte(memory.retiredAt, window.from),
          lt(memory.retiredAt, window.to),
        ),
      )
      .orderBy(desc(memory.retiredAt));

    return {
      activeCount: Number(active?.memories ?? 0),
      flagged: retired.flatMap((row) => {
        if (!row.at) {
          return [];
        }

        const retirement = MemoryRetirement.rehydrate({
          at: row.at,
          by: row.by ? UserId.of(row.by) : null,
          reason: row.reason,
          supersededBy: row.supersededBy ? MemoryId.of(row.supersededBy) : null,
        });

        return retirement.flaggedWrong
          ? [
              {
                memoryId: row.memoryId,
                handle: MemoryHandle.of(row.handle).value,
                body: row.body,
                reason: retirement.reason,
                by: retirement.by?.value ?? null,
                at: retirement.at,
              },
            ]
          : [];
      }),
    };
  }
}
