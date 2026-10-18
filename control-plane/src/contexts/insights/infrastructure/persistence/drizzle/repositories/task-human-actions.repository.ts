import { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import { TaskHumanActionsVersionConflictError } from '@insights/domain/exceptions/task-human-actions-version-conflict.error';
import type { TaskHumanActionsRepository } from '@insights/domain/repositories/task-human-actions.repository';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { TaskHumanAction } from '@insights/domain/value-objects/task-human-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { DrizzleRunFactProjection } from '@insights/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { taskHumanAction } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
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
    lineId: row.lineId,
    stationId: row.stationId,
    by: row.openedBy ? UserId.of(row.openedBy) : null,
    at: row.openedAt,
  });
};

const toHumanActions = (row: HumanActionsRow): TaskHumanActions =>
  TaskHumanActions.rehydrate({
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    opening: openingOf(row),
    asks: row.asks.map((each) =>
      InboxAsk.of(each.stationId, new Date(each.at)),
    ),
    actions: row.actions.map((each) =>
      TaskHumanAction.of({
        kind: each.kind,
        by: UserId.of(each.by),
        stationId: each.stationId,
        at: new Date(each.at),
      }),
    ),
    version: row.version,
  });

const columnsOf = (humanActions: TaskHumanActions) => ({
  teamId: humanActions.opening?.teamId.value ?? null,
  lineId: humanActions.opening?.lineId ?? null,
  stationId: humanActions.opening?.stationId ?? null,
  openedBy: humanActions.opening?.by?.value ?? null,
  openedAt: humanActions.opening?.at ?? null,
  asks: humanActions.asks.map((each) => ({
    stationId: each.stationId,
    at: each.at.toISOString(),
  })),
  actions: humanActions.actions.map((each) => ({
    kind: each.kind,
    by: each.by.value,
    stationId: each.stationId,
    at: each.at.toISOString(),
  })),
  lastActionAt: humanActions.lastActionAt,
});

@Injectable()
export class DrizzleTaskHumanActionsRepository
  implements TaskHumanActionsRepository
{
  constructor(
    private readonly context: DrizzleContext,
    private readonly facts: DrizzleRunFactProjection,
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

      await this.facts.refresh({
        kind: 'tasks',
        taskIds: [added.taskId.value],
      });
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

      await this.facts.refresh({
        kind: 'tasks',
        taskIds: [saved.taskId.value],
      });
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

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(taskHumanAction)
        .where(eq(taskHumanAction.taskId, taskId.value));

      await this.facts.refresh({ kind: 'tasks', taskIds: [taskId.value] });
    });
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.inTransaction(async () => {
      const removed = await this.context.db
        .delete(taskHumanAction)
        .where(
          and(
            eq(taskHumanAction.workspaceId, workspaceId.value),
            eq(taskHumanAction.teamId, teamId.value),
          ),
        )
        .returning({ taskId: taskHumanAction.taskId });

      await this.facts.deleteOpenings({
        kind: 'tasks',
        workspaceId: workspaceId.value,
        taskIds: removed.map((each) => each.taskId),
      });
    });
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(taskHumanAction)
        .where(eq(taskHumanAction.workspaceId, workspaceId.value));

      await this.facts.deleteOpenings({
        kind: 'workspace',
        workspaceId: workspaceId.value,
      });
    });
  }
}
