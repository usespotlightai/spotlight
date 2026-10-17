import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { Egress } from '@runners/domain/aggregates/egress.aggregate';
import { EgressAlreadyDefinedError } from '@runners/domain/exceptions/egress-already-defined.error';
import { EgressTokenTakenError } from '@runners/domain/exceptions/egress-token-taken.error';
import { EgressVersionConflictError } from '@runners/domain/exceptions/egress-version-conflict.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { egress } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

type Row = typeof egress.$inferSelect;

const written = (kept: Egress) => ({
  key: kept.key.value,
  url: kept.url.value,
  tokenHash: kept.tokenHash.value,
  tokenVersion: kept.tokenVersion,
});

const toEgress = (row: Row): Egress =>
  Egress.rehydrate({
    id: EgressId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    key: EgressKey.of(row.key),
    url: EgressUrl.of(row.url),
    tokenHash: TokenHash.of(row.tokenHash),
    tokenVersion: row.tokenVersion,
    version: row.version,
  });

const refusedAs = (error: unknown, key: string): unknown => {
  if (violates(error, UNIQUE_VIOLATION, 'egress_workspace_key')) {
    return new EgressAlreadyDefinedError(key);
  }

  if (violates(error, UNIQUE_VIOLATION, 'egress_token_hash')) {
    return new EgressTokenTakenError();
  }

  return error;
};

@Injectable()
export class DrizzleEgressRepository implements EgressRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Egress): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(egress).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          ...written(added),
          version: added.version,
        });
      } catch (error) {
        throw refusedAs(error, added.key.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Egress): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(egress.id, saved.id.value),
        eq(egress.version, saved.version),
      );
      const stored = !saved.isRetired
        ? await this.context.db
            .update(egress)
            .set({ ...written(saved), version: saved.version + 1 })
            .where(matching)
            .returning({ id: egress.id })
            .catch((error: unknown) => {
              throw refusedAs(error, saved.key.value);
            })
        : await this.context.db
            .delete(egress)
            .where(matching)
            .returning({ id: egress.id });

      if (stored.length === 0) {
        throw new EgressVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  find(id: EgressId): Promise<Egress | null> {
    return this.one(eq(egress.id, id.value));
  }

  findToName(id: EgressId): Promise<Egress | null> {
    return this.one(eq(egress.id, id.value), 'share');
  }

  findToRetire(id: EgressId): Promise<Egress | null> {
    return this.one(eq(egress.id, id.value), 'update');
  }

  findByTokenHash(hash: TokenHash): Promise<Egress | null> {
    return this.one(eq(egress.tokenHash, hash.value));
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<readonly Egress[]> {
    const rows = await this.context.db
      .select()
      .from(egress)
      .where(eq(egress.workspaceId, workspaceId.value));

    return rows.map(toEgress);
  }

  private async one(
    where: SQL,
    lock: 'share' | 'update' | null = null,
  ): Promise<Egress | null> {
    const chosen = this.context.db.select().from(egress).where(where).limit(1);
    const [found] = lock ? await chosen.for(lock) : await chosen;

    return found ? toEgress(found) : null;
  }
}
