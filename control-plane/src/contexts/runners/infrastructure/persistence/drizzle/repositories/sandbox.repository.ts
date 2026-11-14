import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  SANDBOX_STATES,
  Sandbox,
} from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxKeyTakenError } from '@runners/domain/exceptions/sandbox-key-taken.error';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { LeaseHolder } from '@runners/domain/value-objects/lease-holder.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import { SandboxLease } from '@runners/domain/value-objects/sandbox-lease.vo';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import {
  type SandboxLeaseRecord,
  type SandboxWarmRecord,
  sandbox,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, gte, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';

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

const leaseOf = (record: SandboxLeaseRecord): SandboxLease =>
  SandboxLease.of(
    LeaseHolder.of(record.kind, record.holder),
    new Date(record.renewedAt),
  );

const sourceOf = (row: Row): CredentialSource | null => {
  if (row.poolId !== null) {
    return CredentialSource.of('pool', row.poolId);
  }

  return row.trustId === null
    ? null
    : CredentialSource.of('trust', row.trustId);
};

const warmOf = (record: SandboxWarmRecord | null): WarmPart | null =>
  record
    ? WarmPart.of({
        lineId: LineId.of(record.lineId),
        placement: RunnerPlacement.ofLabelGroups(
          record.labelGroups,
          record.image === null ? null : RunnerImage.of(record.image),
        ),
        checkouts: record.checkouts,
        fingerprint: record.fingerprint,
      })
    : null;

const warmRecordOf = (warm: WarmPart | null): SandboxWarmRecord | null =>
  warm
    ? {
        lineId: warm.lineId.value,
        labelGroups: warm.placement.labelGroups,
        image: warm.image?.value ?? null,
        checkouts: warm.checkouts.map((each) => ({
          path: each.path,
          setup: each.setup,
        })),
        fingerprint: warm.fingerprint,
      }
    : null;

const toSandbox = (row: Row): Sandbox =>
  Sandbox.rehydrate({
    id: SandboxId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    key: row.key === null ? null : SandboxKey.of(row.key),
    hostId: row.hostId === null ? null : HostId.of(row.hostId),
    source: sourceOf(row),
    tokenHash: row.tokenHash === null ? null : TokenHash.of(row.tokenHash),
    state: stateOf(row),
    leases: row.leases.map(leaseOf),
    idleSince: row.idleSince,
    startedAt: row.startedAt,
    goneAt: row.goneAt,
    warm: warmOf(row.warm),
    version: row.version,
  });

const columnsOf = (saved: Sandbox) => ({
  key: saved.key?.value ?? null,
  hostId: saved.hostId?.value ?? null,
  poolId: saved.source?.poolId?.value ?? null,
  trustId: saved.source?.trustId?.value ?? null,
  tokenHash: saved.tokenHash?.value ?? null,
  startedAt: saved.startedAt,
  state: saved.current,
  leases: saved.leases.map(
    (each): SandboxLeaseRecord => ({
      kind: each.holder.kind,
      holder: each.holder.id,
      renewedAt: each.renewedAt.toISOString(),
    }),
  ),
  idleSince: saved.idleSince,
  goneAt: saved.goneAt,
  warm: warmRecordOf(saved.warm),
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
      const written = await this.context
        .inSavepoint(() =>
          this.context.db
            .update(sandbox)
            .set({ ...columnsOf(saved), version: saved.version + 1 })
            .where(
              and(
                eq(sandbox.id, saved.id.value),
                eq(sandbox.version, saved.version),
              ),
            )
            .returning({ id: sandbox.id }),
        )
        .catch((error: unknown) => {
          if (violates(error, UNIQUE_VIOLATION, 'sandbox_open_key_idx')) {
            throw new SandboxKeyTakenError(saved.id.value);
          }

          throw error;
        });

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
          eq(sandbox.state, 'open'),
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
          isNotNull(sandbox.key),
          eq(sandbox.state, 'open'),
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

  async liveIn(workspaceId: WorkspaceId): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(
        and(
          eq(sandbox.workspaceId, workspaceId.value),
          ne(sandbox.state, 'gone'),
        ),
      );

    return rows.map(toSandbox);
  }

  async openWarm(): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(and(isNotNull(sandbox.warm), eq(sandbox.state, 'open')))
      .orderBy(sandbox.startedAt, sandbox.id);

    return rows.map(toSandbox);
  }

  async openWarmIn(workspaceId: WorkspaceId): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(
        and(
          eq(sandbox.workspaceId, workspaceId.value),
          isNotNull(sandbox.warm),
          eq(sandbox.state, 'open'),
        ),
      )
      .orderBy(sandbox.startedAt, sandbox.id);

    return rows.map(toSandbox);
  }

  async lostWarmSince(cutoff: Date): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(
        and(
          isNotNull(sandbox.warm),
          eq(sandbox.state, 'gone'),
          gte(sandbox.goneAt, cutoff),
        ),
      );

    return rows.map(toSandbox);
  }

  async holdingRun(runId: RunId): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(
        and(
          ne(sandbox.state, 'gone'),
          sql`${sandbox.leases} @> ${JSON.stringify([{ kind: 'run', holder: runId.value }])}::jsonb`,
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
          eq(sandbox.state, 'open'),
          isNotNull(sandbox.idleSince),
          lte(sandbox.idleSince, cutoff),
        ),
      );

    return rows.map(toSandbox);
  }

  async archivingRenewedBefore(cutoff: Date): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(
        and(
          ne(sandbox.state, 'gone'),
          sql`exists (select 1 from jsonb_array_elements(${sandbox.leases}) as lease where lease->>'kind' = 'archive' and (lease->>'renewedAt')::timestamptz <= ${cutoff.toISOString()}::timestamptz)`,
        ),
      );

    return rows.map(toSandbox);
  }

  async goneBefore(cutoff: Date): Promise<readonly Sandbox[]> {
    const rows = await this.context.db
      .select()
      .from(sandbox)
      .where(and(eq(sandbox.state, 'gone'), lte(sandbox.goneAt, cutoff)));

    return rows.map(toSandbox);
  }

  async remove(removed: Sandbox): Promise<void> {
    await this.context.inTransaction(async () => {
      const gone = await this.context.db
        .delete(sandbox)
        .where(
          and(
            eq(sandbox.id, removed.id.value),
            eq(sandbox.version, removed.version),
          ),
        )
        .returning({ id: sandbox.id });

      if (gone.length === 0) {
        throw new SandboxVersionConflictError(removed.id.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }
}
