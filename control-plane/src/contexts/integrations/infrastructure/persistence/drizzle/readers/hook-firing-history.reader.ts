import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type { HookFiringRepeats } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { CausalChain } from '@integrations/domain/value-objects/causal-chain.vo';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { hookFiring } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, count, eq, gte, lt, or, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleHookFiringHistory implements HookFiringHistoryPort {
  constructor(private readonly context: DrizzleContext) {}

  async recentRepeats(repeats: HookFiringRepeats): Promise<number> {
    const { before } = repeats;
    const [row] = await this.context.db
      .select({ repeats: count() })
      .from(hookFiring)
      .where(
        and(
          eq(hookFiring.hookId, repeats.hookId.value),
          eq(hookFiring.taskId, repeats.taskId.value),
          gte(hookFiring.firedAt, repeats.since),
          or(
            lt(hookFiring.firedAt, before.firedAt),
            and(
              eq(hookFiring.firedAt, before.firedAt),
              lt(hookFiring.id, before.id.value),
            ),
          ),
          sql`${hookFiring.link}->>'key' = ${repeats.link.key}`,
        ),
      );

    return row?.repeats ?? 0;
  }

  async chainOf(
    workspaceId: WorkspaceId,
    firingId: HookFiringId,
  ): Promise<CausalChain | null> {
    const [row] = await this.context.db
      .select({ cause: hookFiring.cause, link: hookFiring.link })
      .from(hookFiring)
      .where(
        and(
          eq(hookFiring.id, firingId.value),
          eq(hookFiring.workspaceId, workspaceId.value),
        ),
      );

    return row ? CausalChain.read(row.cause).append(row.link) : null;
  }
}
