import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { hookFiring } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { and, count, eq, gte, lt, or, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleHookFiringHistory implements HookFiringHistoryPort {
  constructor(private readonly context: DrizzleContext) {}

  async recentRepeats(firing: HookFiring): Promise<number> {
    const [row] = await this.context.db
      .select({ repeats: count() })
      .from(hookFiring)
      .where(
        and(
          eq(hookFiring.hookId, firing.hookId),
          eq(hookFiring.taskId, firing.taskId),
          gte(hookFiring.firedAt, firing.repeatsCountedSince),
          or(
            lt(hookFiring.firedAt, firing.firedAt),
            and(
              eq(hookFiring.firedAt, firing.firedAt),
              lt(hookFiring.id, firing.id),
            ),
          ),
          sql`${hookFiring.link}->>'key' = ${firing.link.key}`,
        ),
      );

    return row?.repeats ?? 0;
  }

  async chainOf(
    workspaceId: string,
    firingId: string,
  ): Promise<CausalChain | null> {
    const [row] = await this.context.db
      .select({ cause: hookFiring.cause, link: hookFiring.link })
      .from(hookFiring)
      .where(
        and(
          eq(hookFiring.id, firingId),
          eq(hookFiring.workspaceId, workspaceId),
        ),
      );

    return row ? CausalChain.read(row.cause).append(row.link) : null;
  }
}
