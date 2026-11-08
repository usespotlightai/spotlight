import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InboxWatch } from '@work/domain/aggregates/inbox-watch.aggregate';
import { InboxWatchVersionConflictError } from '@work/domain/exceptions/inbox-watch-version-conflict.error';
import type { InboxWatchRepository } from '@work/domain/repositories/inbox-watch.repository';
import { inboxWatch } from '@work/infrastructure/persistence/drizzle/schemas/inbox-watch.schema';
import { and, asc, eq, isNotNull, isNull, lte, or } from 'drizzle-orm';

type Row = typeof inboxWatch.$inferSelect;

const toWatch = (row: Row): InboxWatch =>
  InboxWatch.rehydrate({
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

const changing = (watch: InboxWatch) => ({
  watching: [...watch.watching],
  announced: watch.announced.map((each) => ({
    person: each.person,
    itemId: each.itemId,
    askedAt: each.askedAt.toISOString(),
  })),
  sightedAt: watch.sightedAt,
  recountRequestedAt: watch.recount?.requestedAt ?? null,
  jobAttempts: watch.recount?.attempts ?? 0,
  jobDueAt: watch.recount?.dueAt ?? null,
});

@Injectable()
export class DrizzleInboxWatchRepository implements InboxWatchRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(workspaceId: WorkspaceId): Promise<InboxWatch | null> {
    const [row] = await this.context.db
      .select()
      .from(inboxWatch)
      .where(eq(inboxWatch.workspaceId, workspaceId.value))
      .limit(1);

    return row ? toWatch(row) : null;
  }

  async nextDueJob(now: Date): Promise<InboxWatch | null> {
    const [row] = await this.context.db
      .select()
      .from(inboxWatch)
      .where(
        and(
          isNotNull(inboxWatch.recountRequestedAt),
          or(isNull(inboxWatch.jobDueAt), lte(inboxWatch.jobDueAt, now)),
        ),
      )
      .orderBy(asc(inboxWatch.recountRequestedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toWatch(row) : null;
  }

  async add(added: InboxWatch): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(inboxWatch)
        .values({
          workspaceId: added.workspaceId.value,
          ...changing(added),
          version: added.version,
        })
        .onConflictDoNothing({ target: inboxWatch.workspaceId })
        .returning({ workspaceId: inboxWatch.workspaceId });

      if (written.length === 0) {
        throw new InboxWatchVersionConflictError(added.workspaceId.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: InboxWatch): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(inboxWatch)
        .set({ ...changing(saved), version: saved.version + 1 })
        .where(
          and(
            eq(inboxWatch.workspaceId, saved.workspaceId.value),
            eq(inboxWatch.version, saved.version),
          ),
        )
        .returning({ workspaceId: inboxWatch.workspaceId });

      if (written.length === 0) {
        throw new InboxWatchVersionConflictError(saved.workspaceId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async remove(removed: InboxWatch): Promise<void> {
    const gone = await this.context.db
      .delete(inboxWatch)
      .where(
        and(
          eq(inboxWatch.workspaceId, removed.workspaceId.value),
          eq(inboxWatch.version, removed.version),
        ),
      )
      .returning({ workspaceId: inboxWatch.workspaceId });

    if (gone.length === 0) {
      throw new InboxWatchVersionConflictError(removed.workspaceId.value);
    }
  }
}
