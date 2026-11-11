import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ArrivalLedger } from '@notifications/domain/aggregates/arrival-ledger.aggregate';
import { ArrivalLedgerVersionConflictError } from '@notifications/domain/exceptions/arrival-ledger-version-conflict.error';
import type { ArrivalLedgerRepository } from '@notifications/domain/repositories/arrival-ledger.repository';
import { arrivalLedger } from '@notifications/infrastructure/persistence/drizzle/schemas/arrival-ledger.schema';
import { and, asc, eq, isNotNull, isNull, lte, or } from 'drizzle-orm';

type Row = typeof arrivalLedger.$inferSelect;

const toLedger = (row: Row): ArrivalLedger =>
  ArrivalLedger.rehydrate({
    workspaceId: WorkspaceId.of(row.workspaceId),
    watching: row.watching,
    announced: row.announced.map((each) => ({
      person: each.person,
      itemId: each.itemId,
      askedAt: new Date(each.askedAt),
    })),
    sightedAt: row.sightedAt,
    recount: row.recountRequestedAt
      ? {
          requestedAt: row.recountRequestedAt,
          attempts: row.jobAttempts,
          dueAt: row.jobDueAt,
        }
      : null,
    version: row.version,
  });

const changing = (ledger: ArrivalLedger) => ({
  watching: [...ledger.watching],
  announced: ledger.announced.map((each) => ({
    person: each.person,
    itemId: each.itemId,
    askedAt: each.askedAt.toISOString(),
  })),
  sightedAt: ledger.sightedAt,
  recountRequestedAt: ledger.recount?.requestedAt ?? null,
  jobAttempts: ledger.recount?.attempts ?? 0,
  jobDueAt: ledger.recount?.dueAt ?? null,
});

@Injectable()
export class DrizzleArrivalLedgerRepository implements ArrivalLedgerRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(workspaceId: WorkspaceId): Promise<ArrivalLedger | null> {
    const [row] = await this.context.db
      .select()
      .from(arrivalLedger)
      .where(eq(arrivalLedger.workspaceId, workspaceId.value))
      .limit(1);

    return row ? toLedger(row) : null;
  }

  async nextDueJob(now: Date): Promise<ArrivalLedger | null> {
    const [row] = await this.context.db
      .select()
      .from(arrivalLedger)
      .where(
        and(
          isNotNull(arrivalLedger.recountRequestedAt),
          or(isNull(arrivalLedger.jobDueAt), lte(arrivalLedger.jobDueAt, now)),
        ),
      )
      .orderBy(asc(arrivalLedger.recountRequestedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toLedger(row) : null;
  }

  async add(added: ArrivalLedger): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(arrivalLedger)
        .values({
          workspaceId: added.workspaceId.value,
          ...changing(added),
          version: added.version,
        })
        .onConflictDoNothing({ target: arrivalLedger.workspaceId })
        .returning({ workspaceId: arrivalLedger.workspaceId });

      if (written.length === 0) {
        throw new ArrivalLedgerVersionConflictError(added.workspaceId.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: ArrivalLedger): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(arrivalLedger)
        .set({ ...changing(saved), version: saved.version + 1 })
        .where(
          and(
            eq(arrivalLedger.workspaceId, saved.workspaceId.value),
            eq(arrivalLedger.version, saved.version),
          ),
        )
        .returning({ workspaceId: arrivalLedger.workspaceId });

      if (written.length === 0) {
        throw new ArrivalLedgerVersionConflictError(saved.workspaceId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async remove(removed: ArrivalLedger): Promise<void> {
    const gone = await this.context.db
      .delete(arrivalLedger)
      .where(
        and(
          eq(arrivalLedger.workspaceId, removed.workspaceId.value),
          eq(arrivalLedger.version, removed.version),
        ),
      )
      .returning({ workspaceId: arrivalLedger.workspaceId });

    if (gone.length === 0) {
      throw new ArrivalLedgerVersionConflictError(removed.workspaceId.value);
    }
  }
}
