import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InboxRequest } from '@work/domain/aggregates/inbox-request.aggregate';
import { InboxRequestAlreadyOpenError } from '@work/domain/exceptions/inbox-request-already-open.error';
import { InboxRequestVersionConflictError } from '@work/domain/exceptions/inbox-request-version-conflict.error';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';
import type { InboxRequestForm } from '@work/domain/value-objects/inbox-request-form';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestRead } from '@work/domain/value-objects/inbox-request-read.vo';
import { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';
import {
  inboxRequest,
  inboxRequestRead,
} from '@work/infrastructure/persistence/drizzle/schemas/inbox-request.schema';
import { and, eq, notInArray } from 'drizzle-orm';

type Row = typeof inboxRequest.$inferSelect;
type ReadRow = typeof inboxRequestRead.$inferSelect;

const toInboxRequest = (row: Row, reads: readonly ReadRow[]): InboxRequest =>
  InboxRequest.rehydrate({
    id: InboxRequestId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: TaskId.of(row.taskId),
    form: row.form,
    about: InboxRequestSubject.of(row.about),
    createdAt: row.createdAt,
    openedAt: row.openedAt,
    reads: reads.map((each) =>
      InboxRequestRead.of({ by: UserId.of(each.userId), at: each.readAt }),
    ),
    resolvedAt: row.resolvedAt,
    version: row.version,
  });

@Injectable()
export class DrizzleInboxRequestRepository implements InboxRequestRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: InboxRequest): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(inboxRequest).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          taskId: added.taskId.value,
          form: added.form,
          about: added.about.value,
          createdAt: added.createdAt,
          openedAt: added.openedAt,
          resolvedAt: added.resolvedAt,
          version: added.version,
        });
      } catch (error) {
        if (violates(error, UNIQUE_VIOLATION, 'inbox_request_about_idx')) {
          throw new InboxRequestAlreadyOpenError(
            added.taskId.value,
            added.form,
          );
        }

        throw error;
      }

      await this.savesReads(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: InboxRequest): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(inboxRequest)
        .set({
          openedAt: saved.openedAt,
          resolvedAt: saved.resolvedAt,
          version: saved.version + 1,
        })
        .where(
          and(
            eq(inboxRequest.id, saved.id.value),
            eq(inboxRequest.version, saved.version),
          ),
        )
        .returning({ id: inboxRequest.id });

      if (written.length === 0) {
        throw new InboxRequestVersionConflictError(saved.id.value);
      }

      await this.context.db.delete(inboxRequestRead).where(
        and(
          eq(inboxRequestRead.inboxRequestId, saved.id.value),
          saved.reads.length > 0
            ? notInArray(
                inboxRequestRead.userId,
                saved.reads.map((each) => each.by.value),
              )
            : undefined,
        ),
      );
      await this.savesReads(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async savesReads(request: InboxRequest): Promise<void> {
    if (request.reads.length > 0) {
      await this.context.db
        .insert(inboxRequestRead)
        .values(
          request.reads.map((each) => ({
            inboxRequestId: request.id.value,
            userId: each.by.value,
            readAt: each.at,
          })),
        )
        .onConflictDoNothing();
    }
  }

  private async withReads(row: Row): Promise<InboxRequest> {
    const reads = await this.context.db
      .select()
      .from(inboxRequestRead)
      .where(eq(inboxRequestRead.inboxRequestId, row.id));

    return toInboxRequest(row, reads);
  }

  async find(id: InboxRequestId): Promise<InboxRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(inboxRequest)
      .where(eq(inboxRequest.id, id.value))
      .limit(1);

    return row ? this.withReads(row) : null;
  }

  async ofTask(taskId: TaskId): Promise<InboxRequest[]> {
    const rows = await this.context.db
      .select()
      .from(inboxRequest)
      .where(eq(inboxRequest.taskId, taskId.value));

    return Promise.all(rows.map((row) => this.withReads(row)));
  }

  async remove(removed: InboxRequest): Promise<void> {
    const gone = await this.context.db
      .delete(inboxRequest)
      .where(
        and(
          eq(inboxRequest.id, removed.id.value),
          eq(inboxRequest.version, removed.version),
        ),
      )
      .returning({ id: inboxRequest.id });

    if (gone.length === 0) {
      throw new InboxRequestVersionConflictError(removed.id.value);
    }
  }

  async about(
    taskId: TaskId,
    form: InboxRequestForm,
    about: InboxRequestSubject,
  ): Promise<InboxRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(inboxRequest)
      .where(
        and(
          eq(inboxRequest.taskId, taskId.value),
          eq(inboxRequest.form, form),
          eq(inboxRequest.about, about.value),
        ),
      )
      .limit(1);

    return row ? this.withReads(row) : null;
  }
}
