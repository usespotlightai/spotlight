import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import { LIVE_SANDBOX_STATES } from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import {
  runnerHost,
  sandbox,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { and, eq, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleSandboxPlacements implements SandboxPlacementsPort {
  constructor(private readonly context: DrizzleContext) {}

  async idleInPool(poolId: PoolId): Promise<readonly SandboxId[]> {
    const rows = await this.context.db
      .select({ id: sandbox.id })
      .from(sandbox)
      .where(
        and(
          eq(sandbox.poolId, poolId.value),
          ne(sandbox.state, 'gone'),
          isNotNull(sandbox.idleSince),
        ),
      );

    return rows.map((row) => SandboxId.of(row.id));
  }

  async unreportedStartedBefore(cutoff: Date): Promise<readonly SandboxId[]> {
    const rows = await this.context.db
      .select({ id: sandbox.id })
      .from(sandbox)
      .innerJoin(runnerHost, eq(runnerHost.id, sandbox.hostId))
      .where(
        and(
          inArray(sandbox.state, [...LIVE_SANDBOX_STATES]),
          lte(sandbox.startedAt, cutoff),
          sql`not ${runnerHost.sandboxes} @> jsonb_build_array(${sandbox.id})`,
        ),
      );

    return rows.map((row) => SandboxId.of(row.id));
  }

  async liveOnHostsSilentSince(cutoff: Date): Promise<readonly SandboxId[]> {
    const rows = await this.context.db
      .select({ id: sandbox.id })
      .from(sandbox)
      .leftJoin(runnerHost, eq(runnerHost.id, sandbox.hostId))
      .where(
        and(
          inArray(sandbox.state, [...LIVE_SANDBOX_STATES]),
          isNotNull(sandbox.hostId),
          or(
            sql`${runnerHost.id} is null`,
            lte(runnerHost.lastHeartbeatAt, cutoff),
          ),
        ),
      );

    return rows.map((row) => SandboxId.of(row.id));
  }
}
