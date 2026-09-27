import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TaskAside } from '@work/domain/aggregates/task-aside.aggregate';
import { TaskAsideMovedOnError } from '@work/domain/exceptions/task-aside-moved-on.error';
import type { TaskAsideRepository } from '@work/domain/repositories/task-aside.repository';
import type { AsideForm } from '@work/domain/value-objects/aside-form';
import { AsideRead } from '@work/domain/value-objects/aside-read.vo';
import { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';
import {
  taskAside,
  taskAsideRead,
} from '@work/infrastructure/persistence/drizzle/schemas/task-aside.schema';
import { and, eq } from 'drizzle-orm';

type Row = typeof taskAside.$inferSelect;
type ReadRow = typeof taskAsideRead.$inferSelect;

const toAside = (row: Row, reads: readonly ReadRow[]): TaskAside =>
  TaskAside.rehydrate({
    id: TaskAsideId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: TaskId.of(row.taskId),
    form: row.form,
    about: row.about,
    raisedAt: row.raisedAt,
    reads: reads.map((each) =>
      AsideRead.of({ by: UserId.of(each.userId), at: each.readAt }),
    ),
    settledAt: row.settledAt,
    version: row.version,
  });

@Injectable()
export class DrizzleTaskAsideRepository implements TaskAsideRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: TaskAside): Promise<void> {
    await this.context.run(async () => {
      await this.context.db.insert(taskAside).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        taskId: added.taskId.value,
        form: added.form,
        about: added.about,
        raisedAt: added.raisedAt,
        settledAt: added.settledAt,
        version: added.version,
      });
      await this.readsKept(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: TaskAside): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .update(taskAside)
        .set({
          settledAt: saved.settledAt,
          version: saved.version + 1,
        })
        .where(
          and(
            eq(taskAside.id, saved.id.value),
            eq(taskAside.version, saved.version),
          ),
        )
        .returning({ id: taskAside.id });

      if (written.length === 0) {
        throw new TaskAsideMovedOnError(saved.id.value);
      }

      await this.readsKept(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async readsKept(aside: TaskAside): Promise<void> {
    if (aside.reads.length > 0) {
      await this.context.db
        .insert(taskAsideRead)
        .values(
          aside.reads.map((each) => ({
            asideId: aside.id.value,
            userId: each.by.value,
            readAt: each.at,
          })),
        )
        .onConflictDoNothing();
    }
  }

  private async withReads(row: Row): Promise<TaskAside> {
    const reads = await this.context.db
      .select()
      .from(taskAsideRead)
      .where(eq(taskAsideRead.asideId, row.id));

    return toAside(row, reads);
  }

  async find(id: TaskAsideId): Promise<TaskAside | null> {
    const [row] = await this.context.db
      .select()
      .from(taskAside)
      .where(eq(taskAside.id, id.value))
      .limit(1);

    return row ? this.withReads(row) : null;
  }

  async about(
    taskId: TaskId,
    form: AsideForm,
    about: string,
  ): Promise<TaskAside | null> {
    const [row] = await this.context.db
      .select()
      .from(taskAside)
      .where(
        and(
          eq(taskAside.taskId, taskId.value),
          eq(taskAside.form, form),
          eq(taskAside.about, about),
        ),
      )
      .limit(1);

    return row ? this.withReads(row) : null;
  }
}
