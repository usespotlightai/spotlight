import { Injectable } from '@nestjs/common';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { TaskDeliveryMovedOnError } from '@outcomes/domain/exceptions/task-delivery-moved-on.error';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import { taskDelivery } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray } from 'drizzle-orm';

type DeliveryRow = typeof taskDelivery.$inferSelect;

const toDelivery = (row: DeliveryRow): TaskDelivery =>
  TaskDelivery.rehydrate({
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    pullRequest: PullRequestUrl.of(row.pullRequest),
    state: row.state,
    closedAt: row.closedAt,
    version: row.version,
  });

const columnsOf = (delivery: TaskDelivery) => ({
  pullRequest: delivery.pullRequest.value,
  state: delivery.state,
  closedAt: delivery.closedAt,
});

@Injectable()
export class DrizzleTaskDeliveryRepository implements TaskDeliveryRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: TaskDelivery): Promise<void> {
    const written = await this.context.db
      .insert(taskDelivery)
      .values({
        taskId: added.taskId.value,
        workspaceId: added.workspaceId.value,
        version: added.version,
        ...columnsOf(added),
      })
      .onConflictDoNothing({ target: taskDelivery.taskId })
      .returning({ taskId: taskDelivery.taskId });

    if (written.length === 0) {
      throw new TaskDeliveryMovedOnError(added.taskId.value);
    }
  }

  async save(saved: TaskDelivery): Promise<void> {
    const written = await this.context.db
      .update(taskDelivery)
      .set({ version: saved.version + 1, ...columnsOf(saved) })
      .where(
        and(
          eq(taskDelivery.taskId, saved.taskId.value),
          eq(taskDelivery.version, saved.version),
        ),
      )
      .returning({ taskId: taskDelivery.taskId });

    if (written.length === 0) {
      throw new TaskDeliveryMovedOnError(saved.taskId.value);
    }
  }

  async forTask(taskId: TaskId): Promise<TaskDelivery | null> {
    const [row] = await this.context.db
      .select()
      .from(taskDelivery)
      .where(eq(taskDelivery.taskId, taskId.value))
      .limit(1);

    return row ? toDelivery(row) : null;
  }

  async forTasks(taskIds: readonly TaskId[]): Promise<readonly TaskDelivery[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(taskDelivery)
      .where(
        inArray(
          taskDelivery.taskId,
          taskIds.map((each) => each.value),
        ),
      );

    return rows.map(toDelivery);
  }

  async forPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskDelivery | null> {
    const [row] = await this.context.db
      .select()
      .from(taskDelivery)
      .where(
        and(
          eq(taskDelivery.workspaceId, workspaceId.value),
          eq(taskDelivery.pullRequest, pullRequest.value),
        ),
      )
      .limit(1);

    return row ? toDelivery(row) : null;
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(taskDelivery)
      .where(eq(taskDelivery.taskId, taskId.value));
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(taskDelivery)
      .where(eq(taskDelivery.workspaceId, workspaceId.value));
  }
}
