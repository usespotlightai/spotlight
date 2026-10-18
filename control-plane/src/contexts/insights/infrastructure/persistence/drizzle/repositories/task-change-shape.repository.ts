import { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import { TaskChangeShapeVersionConflictError } from '@insights/domain/exceptions/task-change-shape-version-conflict.error';
import type { TaskChangeShapeRepository } from '@insights/domain/repositories/task-change-shape.repository';
import { taskChangeShape } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type ShapeRow = typeof taskChangeShape.$inferSelect;

const toShape = (row: ShapeRow): TaskChangeShape =>
  TaskChangeShape.rehydrate({
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    shape: {
      changeTitles: row.changeTitles,
      changeIntents: row.changeIntents,
      at: row.shapedAt,
    },
    version: row.version,
  });

const columnsOf = (shape: TaskChangeShape) => ({
  changeTitles: [...shape.shape.changeTitles],
  changeIntents: [...shape.shape.changeIntents],
  shapedAt: shape.shape.at,
});

@Injectable()
export class DrizzleTaskChangeShapeRepository
  implements TaskChangeShapeRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async forTask(taskId: TaskId): Promise<TaskChangeShape | null> {
    const [row] = await this.context.db
      .select()
      .from(taskChangeShape)
      .where(eq(taskChangeShape.taskId, taskId.value))
      .limit(1);

    return row ? toShape(row) : null;
  }

  async add(added: TaskChangeShape): Promise<void> {
    const written = await this.context.db
      .insert(taskChangeShape)
      .values({
        taskId: added.taskId.value,
        workspaceId: added.workspaceId.value,
        teamId: added.teamId.value,
        version: added.version + 1,
        ...columnsOf(added),
      })
      .onConflictDoNothing({ target: taskChangeShape.taskId })
      .returning({ taskId: taskChangeShape.taskId });

    if (written.length === 0) {
      throw new TaskChangeShapeVersionConflictError(added.taskId.value);
    }
  }

  async save(saved: TaskChangeShape): Promise<void> {
    const written = await this.context.db
      .update(taskChangeShape)
      .set({ version: saved.version + 1, ...columnsOf(saved) })
      .where(
        and(
          eq(taskChangeShape.taskId, saved.taskId.value),
          eq(taskChangeShape.version, saved.version),
        ),
      )
      .returning({ taskId: taskChangeShape.taskId });

    if (written.length === 0) {
      throw new TaskChangeShapeVersionConflictError(saved.taskId.value);
    }
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(taskChangeShape)
      .where(eq(taskChangeShape.taskId, taskId.value));
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(taskChangeShape)
      .where(
        and(
          eq(taskChangeShape.workspaceId, workspaceId.value),
          eq(taskChangeShape.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(taskChangeShape)
      .where(eq(taskChangeShape.workspaceId, workspaceId.value));
  }
}
