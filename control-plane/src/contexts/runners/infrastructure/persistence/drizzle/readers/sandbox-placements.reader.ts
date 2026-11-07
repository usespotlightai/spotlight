import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import { LIVE_SANDBOX_STATES } from '@runners/domain/aggregates/sandbox.aggregate';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import {
  runnerHost,
  sandbox,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, gt, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleSandboxPlacements implements SandboxPlacementsPort {
  constructor(private readonly context: DrizzleContext) {}

  async liveKeysIn(
    workspaceId: WorkspaceId,
    heardSince: Date,
  ): Promise<readonly SandboxKey[]> {
    const rows = await this.context.db
      .select({ key: sandbox.key })
      .from(sandbox)
      .innerJoin(runnerHost, eq(runnerHost.id, sandbox.hostId))
      .where(
        and(
          eq(sandbox.workspaceId, workspaceId.value),
          ne(sandbox.state, 'gone'),
          isNotNull(sandbox.key),
          gt(runnerHost.lastHeartbeatAt, heardSince),
        ),
      );

    return rows.flatMap((row) => (row.key ? [SandboxKey.of(row.key)] : []));
  }

  async idleInPool(poolId: RunnerPoolId): Promise<readonly SandboxId[]> {
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
