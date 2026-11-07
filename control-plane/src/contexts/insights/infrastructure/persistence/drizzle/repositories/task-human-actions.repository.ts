import { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import { TaskHumanActionsVersionConflictError } from '@insights/domain/exceptions/task-human-actions-version-conflict.error';
import type { TaskHumanActionsRepository } from '@insights/domain/repositories/task-human-actions.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { TaskHumanAction } from '@insights/domain/value-objects/task-human-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import { taskHumanAction } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { Erased } from '@shared-kernel/domain/erased';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type HumanActionsRow = typeof taskHumanAction.$inferSelect;

const openingOf = (row: HumanActionsRow): TaskOpening | null => {
  if (!row.openedAt) {
    return null;
  }
  if (!row.teamId || !row.lineId || !row.stationId) {
    throw new InconsistentStateError(
      'task human actions',
      'were opened without saying on which team, line and station',
    );
  }

  return TaskOpening.of({
    teamId: TeamId.of(row.teamId),
    lineId: LineId.of(row.lineId),
    stationId: StationId.of(row.stationId),
    by: row.openedById ? UserId.of(row.openedById) : null,
    at: row.openedAt,
  });
};

const toHumanActions = (row: HumanActionsRow): TaskHumanActions =>
  TaskHumanActions.rehydrate({
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    opening: openingOf(row),
    asks: row.asks.map((each) =>
      InboxAsk.of(StationId.of(each.stationId), new Date(each.at)),
    ),
    actions: row.actions.map((each) =>
      TaskHumanAction.of({
        kind: each.kind,
        by: UserId.of(each.by),
        stationId: StationId.of(each.stationId),
        at: new Date(each.at),
      }),
    ),
    version: row.version,
  });

const columnsOf = (humanActions: TaskHumanActions) =>
  ({
    teamId: humanActions.opening?.teamId.value ?? null,
    lineId: humanActions.opening?.lineId.value ?? null,
    stationId: humanActions.opening?.stationId.value ?? null,
    openedById: humanActions.opening?.by?.value ?? null,
    openedAt: humanActions.opening?.at ?? null,
    asks: humanActions.asks.map((each) => ({
      stationId: each.stationId.value,
      at: each.at.toISOString(),
    })),
    actions: humanActions.actions.map((each) => ({
      kind: each.kind,
      by: each.by.value,
      stationId: each.stationId.value,
      at: each.at.toISOString(),
    })),
    lastActionAt: humanActions.lastActionAt,
  }) satisfies Partial<typeof taskHumanAction.$inferInsert>;

@Injectable()
export class DrizzleTaskHumanActionsRepository
  implements TaskHumanActionsRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: TaskHumanActions): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(taskHumanAction)
        .values({
          taskId: added.taskId.value,
          workspaceId: added.workspaceId.value,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({ target: taskHumanAction.taskId })
        .returning({ taskId: taskHumanAction.taskId });

      if (written.length === 0) {
        throw new TaskHumanActionsVersionConflictError(added.taskId.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: TaskHumanActions): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(taskHumanAction)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            eq(taskHumanAction.taskId, saved.taskId.value),
            eq(taskHumanAction.version, saved.version),
          ),
        )
        .returning({ taskId: taskHumanAction.taskId });

      if (written.length === 0) {
        throw new TaskHumanActionsVersionConflictError(saved.taskId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(taskId: TaskId): Promise<TaskHumanActions | null> {
    const [row] = await this.context.db
      .select()
      .from(taskHumanAction)
      .where(eq(taskHumanAction.taskId, taskId.value))
      .limit(1);

    return row ? toHumanActions(row) : null;
  }

  async ofTasks(
    taskIds: readonly TaskId[],
  ): Promise<readonly TaskHumanActions[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(taskHumanAction)
      .where(
        inList(
          taskHumanAction.taskId,
          taskIds.map((each) => each.value),
        ),
      );

    return rows.map(toHumanActions);
  }

  async remove(removed: Erased<TaskHumanActions>): Promise<void> {
    await this.context.inTransaction(async () => {
      const gone = await this.context.db
        .delete(taskHumanAction)
        .where(
          and(
            eq(taskHumanAction.taskId, removed.taskId.value),
            eq(taskHumanAction.version, removed.version),
          ),
        )
        .returning({ taskId: taskHumanAction.taskId });

      if (gone.length === 0) {
        throw new TaskHumanActionsVersionConflictError(removed.taskId.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly TaskHumanActions[]> {
    const rows = await this.context.db
      .select()
      .from(taskHumanAction)
      .where(inScope(taskHumanAction, scope))
      .limit(max);

    return rows.map(toHumanActions);
  }
}
