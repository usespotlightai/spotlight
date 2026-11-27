import { TaskActions } from '@insights/domain/aggregates/task-actions.aggregate';
import { TaskActionsVersionConflictError } from '@insights/domain/exceptions/task-actions-version-conflict.error';
import type { TaskActionsRepository } from '@insights/domain/repositories/task-actions.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { TaskAction } from '@insights/domain/value-objects/task-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import { taskAction } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { firstOf } from '@shared-kernel/domain/item-at';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type TaskActionsRow = typeof taskAction.$inferSelect;

const openingOf = (row: TaskActionsRow): TaskOpening | null => {
  if (!row.openedAt) {
    return null;
  }
  if (
    row.teamId === null ||
    row.teamId === '' ||
    row.lineId === null ||
    row.lineId === '' ||
    row.stationId === null ||
    row.stationId === ''
  ) {
    throw new InconsistentStateError(
      'task actions',
      'were opened without saying on which team, line and station',
    );
  }

  return TaskOpening.of({
    teamId: TeamId.of(row.teamId),
    lineId: LineId.of(row.lineId),
    stationId: StationId.of(row.stationId),
    by:
      row.openedById !== null && row.openedById !== ''
        ? UserId.of(row.openedById)
        : null,
    at: row.openedAt,
  });
};

const toTaskActions = (row: TaskActionsRow): TaskActions =>
  TaskActions.rehydrate({
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    opening: openingOf(row),
    asks: row.asks.map((each) =>
      InboxAsk.of(StationId.of(each.stationId), new Date(each.at)),
    ),
    actions: row.actions.map((each) =>
      TaskAction.of({
        kind: each.kind,
        by: UserId.of(each.by),
        stationId: StationId.of(each.stationId),
        at: new Date(each.at),
      }),
    ),
    version: row.version,
  });

const columnsOf = (taskActions: TaskActions) =>
  ({
    teamId: taskActions.opening?.teamId.value ?? null,
    lineId: taskActions.opening?.lineId.value ?? null,
    stationId: taskActions.opening?.stationId.value ?? null,
    openedById: taskActions.opening?.by?.value ?? null,
    openedAt: taskActions.opening?.at ?? null,
    asks: taskActions.asks.map((each) => ({
      stationId: each.stationId.value,
      at: each.at.toISOString(),
    })),
    actions: taskActions.actions.map((each) => ({
      kind: each.kind,
      by: each.by.value,
      stationId: each.stationId.value,
      at: each.at.toISOString(),
    })),
    lastActionAt: taskActions.lastActionAt,
  }) satisfies Partial<typeof taskAction.$inferInsert>;

@Injectable()
export class DrizzleTaskActionsRepository implements TaskActionsRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: TaskActions): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(taskAction)
        .values({
          taskId: added.taskId.value,
          workspaceId: added.workspaceId.value,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({ target: taskAction.taskId })
        .returning({ taskId: taskAction.taskId });

      if (written.length === 0) {
        throw new TaskActionsVersionConflictError(added.taskId.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: TaskActions): Promise<void> {
    if (saved.isDeleted) {
      return this.removed(saved);
    }

    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(taskAction)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            eq(taskAction.taskId, saved.taskId.value),
            eq(taskAction.version, saved.version),
          ),
        )
        .returning({ taskId: taskAction.taskId });

      if (written.length === 0) {
        throw new TaskActionsVersionConflictError(saved.taskId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(taskId: TaskId): Promise<TaskActions | null> {
    const row = firstOf(
      await this.context.db
        .select()
        .from(taskAction)
        .where(eq(taskAction.taskId, taskId.value))
        .limit(1),
    );

    return row ? toTaskActions(row) : null;
  }

  async ofTasks(taskIds: readonly TaskId[]): Promise<readonly TaskActions[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(taskAction)
      .where(
        inList(
          taskAction.taskId,
          taskIds.map((each) => each.value),
        ),
      );

    return rows.map(toTaskActions);
  }

  private async removed(removed: TaskActions): Promise<void> {
    await this.context.inTransaction(async () => {
      const gone = await this.context.db
        .delete(taskAction)
        .where(
          and(
            eq(taskAction.taskId, removed.taskId.value),
            eq(taskAction.version, removed.version),
          ),
        )
        .returning({ taskId: taskAction.taskId });

      if (gone.length === 0) {
        throw new TaskActionsVersionConflictError(removed.taskId.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly TaskActions[]> {
    const rows = await this.context.db
      .select()
      .from(taskAction)
      .where(inScope(taskAction, scope))
      .limit(max);

    return rows.map(toTaskActions);
  }
}
