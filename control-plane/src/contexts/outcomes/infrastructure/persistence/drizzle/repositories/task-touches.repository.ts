import { Injectable } from '@nestjs/common';
import { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import { TaskTouchesVersionConflictError } from '@outcomes/domain/exceptions/task-touches-version-conflict.error';
import type { TaskTouchesRepository } from '@outcomes/domain/repositories/task-touches.repository';
import { InboxAsk } from '@outcomes/domain/value-objects/inbox-ask.vo';
import { PersonTouch } from '@outcomes/domain/value-objects/person-touch.vo';
import { TaskOpening } from '@outcomes/domain/value-objects/task-opening.vo';
import { DrizzleRunFactProjection } from '@outcomes/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { taskTouches } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type TouchesRow = typeof taskTouches.$inferSelect;

const openingOf = (row: TouchesRow): TaskOpening | null => {
  if (!row.openedAt) {
    return null;
  }
  if (!row.teamId || !row.lineId || !row.stationId) {
    throw new InconsistentStateError(
      'task touches',
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

const toTouches = (row: TouchesRow): TaskTouches =>
  TaskTouches.rehydrate({
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    opening: openingOf(row),
    asks: row.asks.map((each) =>
      InboxAsk.of(each.stationId, new Date(each.at)),
    ),
    acts: row.acts.map((each) =>
      PersonTouch.of({
        act: each.act,
        by: UserId.of(each.by),
        stationId: each.stationId,
        at: new Date(each.at),
      }),
    ),
    version: row.version,
  });

const columnsOf = (touches: TaskTouches) => ({
  teamId: touches.opening?.teamId.value ?? null,
  lineId: touches.opening?.lineId ?? null,
  stationId: touches.opening?.stationId ?? null,
  openedBy: touches.opening?.by?.value ?? null,
  openedAt: touches.opening?.at ?? null,
  asks: touches.asks.map((each) => ({
    stationId: each.stationId,
    at: each.at.toISOString(),
  })),
  acts: touches.acts.map((each) => ({
    act: each.act,
    by: each.by.value,
    stationId: each.stationId,
    at: each.at.toISOString(),
  })),
  touchedAt: touches.touchedAt,
});

@Injectable()
export class DrizzleTaskTouchesRepository implements TaskTouchesRepository {
  constructor(
    private readonly context: DrizzleContext,
    private readonly facts: DrizzleRunFactProjection,
  ) {}

  async add(added: TaskTouches): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .insert(taskTouches)
        .values({
          taskId: added.taskId.value,
          workspaceId: added.workspaceId.value,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({ target: taskTouches.taskId })
        .returning({ taskId: taskTouches.taskId });

      if (written.length === 0) {
        throw new TaskTouchesVersionConflictError(added.taskId.value);
      }

      await this.facts.refresh({
        kind: 'tasks',
        taskIds: [added.taskId.value],
      });
    });
  }

  async save(saved: TaskTouches): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .update(taskTouches)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            eq(taskTouches.taskId, saved.taskId.value),
            eq(taskTouches.version, saved.version),
          ),
        )
        .returning({ taskId: taskTouches.taskId });

      if (written.length === 0) {
        throw new TaskTouchesVersionConflictError(saved.taskId.value);
      }

      await this.facts.refresh({
        kind: 'tasks',
        taskIds: [saved.taskId.value],
      });
    });
  }

  async of(taskId: TaskId): Promise<TaskTouches | null> {
    const [row] = await this.context.db
      .select()
      .from(taskTouches)
      .where(eq(taskTouches.taskId, taskId.value))
      .limit(1);

    return row ? toTouches(row) : null;
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.run(async () => {
      await this.context.db
        .delete(taskTouches)
        .where(eq(taskTouches.taskId, taskId.value));

      await this.facts.refresh({ kind: 'tasks', taskIds: [taskId.value] });
    });
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.run(async () => {
      const removed = await this.context.db
        .delete(taskTouches)
        .where(
          and(
            eq(taskTouches.workspaceId, workspaceId.value),
            eq(taskTouches.teamId, teamId.value),
          ),
        )
        .returning({ taskId: taskTouches.taskId });

      await this.facts.forgetOpenings({
        kind: 'tasks',
        workspaceId: workspaceId.value,
        taskIds: removed.map((each) => each.taskId),
      });
    });
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.run(async () => {
      await this.context.db
        .delete(taskTouches)
        .where(eq(taskTouches.workspaceId, workspaceId.value));

      await this.facts.forgetOpenings({
        kind: 'workspace',
        workspaceId: workspaceId.value,
      });
    });
  }
}
