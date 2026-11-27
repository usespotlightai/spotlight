import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { HostOutage } from '@runners/domain/aggregates/host-outage.aggregate';
import { HostOutageVersionConflictError } from '@runners/domain/exceptions/host-outage-version-conflict.error';
import type { HostOutageRepository } from '@runners/domain/repositories/host-outage.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostOutageId } from '@runners/domain/value-objects/host-outage-id.vo';
import { hostOutage } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { firstOf } from '@shared-kernel/domain/item-at';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type Row = typeof hostOutage.$inferSelect;

const sourceOf = (row: Row): CredentialSource => {
  if (row.poolId !== null) {
    return CredentialSource.of('pool', row.poolId);
  }
  if (row.trustId !== null) {
    return CredentialSource.of('trust', row.trustId);
  }

  throw new InconsistentStateError(
    'host outage',
    'names neither a pool nor a trust',
  );
};

const toOutage = (row: Row): HostOutage =>
  HostOutage.rehydrate({
    id: HostOutageId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    source: sourceOf(row),
    hosts: row.hosts,
    since: row.since,
    raisedAt: row.raisedAt,
    version: row.version,
  });

@Injectable()
export class DrizzleHostOutageRepository implements HostOutageRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(outage: HostOutage): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(hostOutage).values({
          id: outage.id.value,
          workspaceId: outage.workspaceId.value,
          poolId: outage.source.poolId?.value ?? null,
          trustId: outage.source.trustId?.value ?? null,
          hosts: [...outage.hosts],
          since: outage.since,
          raisedAt: outage.raisedAt,
          version: outage.version,
        });
      } catch (error) {
        if (
          violates(error, UNIQUE_VIOLATION, 'host_outage_pkey') ||
          violates(error, UNIQUE_VIOLATION, 'host_outage_pool_idx') ||
          violates(error, UNIQUE_VIOLATION, 'host_outage_trust_idx')
        ) {
          throw new HostOutageVersionConflictError(outage.source.id);
        }

        throw error;
      }

      await this.events.dispatch(outage.pullEvents());
    });
  }

  async remove(outage: HostOutage): Promise<void> {
    await this.context.inTransaction(async () => {
      const removed = await this.context.db
        .delete(hostOutage)
        .where(
          and(
            eq(hostOutage.id, outage.id.value),
            eq(hostOutage.version, outage.version),
          ),
        )
        .returning({ id: hostOutage.id });

      if (removed.length === 0) {
        throw new HostOutageVersionConflictError(outage.source.id);
      }

      await this.events.dispatch(outage.pullEvents());
    });
  }

  async ofSource(source: CredentialSource): Promise<HostOutage | null> {
    const found = firstOf(
      await this.context.db
        .select()
        .from(hostOutage)
        .where(
          source.kind === 'pool'
            ? eq(hostOutage.poolId, source.id)
            : eq(hostOutage.trustId, source.id),
        )
        .limit(1),
    );

    return found ? toOutage(found) : null;
  }

  async all(): Promise<readonly HostOutage[]> {
    return (await this.context.db.select().from(hostOutage)).map(toOutage);
  }
}
