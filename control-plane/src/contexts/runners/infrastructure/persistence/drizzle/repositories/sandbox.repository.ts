import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  LIVE_SANDBOX_STATES,
  OPEN_SANDBOX_STATES,
  SANDBOX_STATES,
  Sandbox,
} from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import {
  SANDBOX_LEASE_KINDS,
  SandboxLease,
} from '@runners/domain/value-objects/sandbox-lease.vo';
import {
  runnerHost,
  type SandboxLeaseRecord,
  sandbox,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';

type Row = typeof sandbox.$inferSelect;

const stateOf = (row: Row) => {
  const state = SANDBOX_STATES.find((each) => each === row.state);

  if (!state) {
    throw new InconsistentStateError(
      'sandbox',
      `is in an unknown state (${row.state})`,
    );
  }

  return state;
};

const leaseOf = (record: SandboxLeaseRecord): SandboxLease => {
  const kind = SANDBOX_LEASE_KINDS.find((each) => each === record.kind);

  if (!kind) {
    throw new InconsistentStateError(
      'sandbox',
      `has a lease of an unknown kind (${record.kind})`,
    );
  }

  return SandboxLease.of(kind, record.holder, new Date(record.renewedAt));
};

const toSandbox = (row: Row): Sandbox =>
  Sandbox.rehydrate({
    id: SandboxId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    key: row.key === null ? null : SandboxKey.of(row.key),
    hostId: row.hostId === null ? null : HostId.of(row.hostId),
    tokenHash: row.tokenHash === null ? null : TokenHash.of(row.tokenHash),
    state: stateOf(row),
    leases: row.leases.map(leaseOf),
    idleSince: row.idleSince,
    startedAt: row.startedAt,
    goneAt: row.goneAt,
    version: row.version,
  });

const columnsOf = (saved: Sandbox) => ({
  hostId: saved.hostId?.value ?? null,
  tokenHash: saved.tokenHash?.value ?? null,
  startedAt: saved.startedAt,
  state: saved.current,
  leases: saved.leases.map(
    (each): SandboxLeaseRecord => ({
      kind: each.kind,
      holder: each.holder,
      renewedAt: each.renewedAt.toISOString(),
    }),
  ),
  idleSince: saved.idleSince,
  goneAt: saved.goneAt,
});

@Injectable()
export class DrizzleSandboxRepository implements SandboxRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Sandbox): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(sandbox).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          key: added.key?.value ?? null,
          ...columnsOf(added),
          version: added.version,
        });
      } catch (error) {
        if (
          violates(error, UNIQUE_VIOLATION, 'sandbox_pkey') ||
          violates(error, UNIQUE_VIOLATION, 'sandbox_open_key_idx')
        ) {
          throw new SandboxVersionConflictError(added.id.value);
        }

        throw error;
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Sandbox): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(sandbox)
        .set({ ...columnsOf(saved), version: saved.version + 1 })
        .where(
          and(
            eq(sandbox.id, saved.id.value),
            eq(sandbox.version, saved.version),
          ),
        )
        .returning({ id: sandbox.id });

      if (written.length === 0) {
        throw new SandboxVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: SandboxId): Promise<Sandbox | null> {
    const [found] = await this.context.db
      .select()
      .from(sandbox)
      .where(eq(sandbox.id, id.value))
      .limit(1);

    return found ? toSandbox(found) : null;
  }

  async openFor(
    workspaceId: WorkspaceId,
    key: SandboxKey,
  ): Promise<Sandbox | null> {
    const [found] = await this.context.db
      .select()
      .from(sandbox)
      .where(
        and(
          eq(sandbox.workspaceId, workspaceId.value),
          eq(sandbox.key, key.value),
          inArray(sandbox.state, [...OPEN_SANDBOX_STATES]),
        ),
      )
      .limit(1);

    return found ? toSandbox(found) : null;
  }

  async liveByTokenHash(hash: TokenHash): Promise<Sandbox | null> {
    const [found] = await this.context.db
      .select()
      .from(sandbox)
      .where(and(eq(sandbox.tokenHash, hash.value), ne(sandbox.state, 'gone')))
      .limit(1);

    return found ? toSandbox(found) : null;
  }

  async requestedIn(
    workspaceId: WorkspaceId,
    limit: number,
  ): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(
        and(
          eq(sandbox.workspaceId, workspaceId.value),
          isNull(sandbox.hostId),
          eq(sandbox.state, 'starting'),
        ),
      )
      .orderBy(sandbox.startedAt, sandbox.id)
      .limit(limit);

    return rows.map(toSandbox);
  }

  async liveOn(hostId: HostId): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(and(eq(sandbox.hostId, hostId.value), ne(sandbox.state, 'gone')));

    return rows.map(toSandbox);
  }

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

  async idleInPool(poolId: RunnerPoolId): Promise<number> {
    const [row] = await this.context.db
      .select({ idle: count() })
      .from(sandbox)
      .innerJoin(runnerHost, eq(runnerHost.id, sandbox.hostId))
      .where(
        and(
          eq(runnerHost.poolId, poolId.value),
          ne(sandbox.state, 'gone'),
          isNotNull(sandbox.idleSince),
        ),
      );

    return row?.idle ?? 0;
  }

  async holdingRun(runId: string): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(
        and(
          ne(sandbox.state, 'gone'),
          sql`${sandbox.leases} @> ${JSON.stringify([{ kind: 'run', holder: runId }])}::jsonb`,
        ),
      );

    return rows.map(toSandbox);
  }

  async idleSince(cutoff: Date): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(
        and(
          inArray(sandbox.state, [...OPEN_SANDBOX_STATES]),
          isNotNull(sandbox.idleSince),
          lte(sandbox.idleSince, cutoff),
        ),
      );

    return rows.map(toSandbox);
  }

  async liveOnHostsSilentSince(cutoff: Date): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select({ sandbox })
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

    return rows.map((row) => toSandbox(row.sandbox));
  }

  async removeGoneBefore(cutoff: Date): Promise<number> {
    const removed = await this.context.db
      .delete(sandbox)
      .where(and(eq(sandbox.state, 'gone'), lte(sandbox.goneAt, cutoff)))
      .returning({ id: sandbox.id });

    return removed.length;
  }
}
