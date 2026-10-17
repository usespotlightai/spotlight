import { Inject, Injectable } from '@nestjs/common';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { TaskDeliveryVersionConflictError } from '@outcomes/domain/exceptions/task-delivery-version-conflict.error';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import { DrizzleRunFactProjection } from '@outcomes/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { taskDelivery } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type DeliveryRow = typeof taskDelivery.$inferSelect;

const toDelivery = (row: DeliveryRow): TaskDelivery =>
  TaskDelivery.rehydrate({
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    pullRequest: PullRequestUrl.of(row.pullRequest),
    state: row.state,
    openedAt: row.openedAt,
    firstReviewAt: row.firstReviewAt,
    closedAt: row.closedAt,
    version: row.version,
  });

const columnsOf = (delivery: TaskDelivery) => ({
  pullRequest: delivery.pullRequest.value,
  state: delivery.state,
  openedAt: delivery.openedAt,
  firstReviewAt: delivery.firstReviewAt,
  closedAt: delivery.closedAt,
});

@Injectable()
export class DrizzleTaskDeliveryRepository implements TaskDeliveryRepository {
  constructor(
    private readonly context: DrizzleContext,
    private readonly facts: DrizzleRunFactProjection,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: TaskDelivery): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(taskDelivery)
        .values({
          taskId: added.taskId.value,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId.value,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({ target: taskDelivery.taskId })
        .returning({ taskId: taskDelivery.taskId });

      if (written.length === 0) {
        throw new TaskDeliveryVersionConflictError(added.taskId.value);
      }

      await this.facts.refresh({
        kind: 'tasks',
        taskIds: [added.taskId.value],
      });

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: TaskDelivery): Promise<void> {
    await this.context.inTransaction(async () => {
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
        throw new TaskDeliveryVersionConflictError(saved.taskId.value);
      }

      await this.facts.refresh({
        kind: 'tasks',
        taskIds: [saved.taskId.value],
      });

      await this.events.dispatch(saved.pullEvents());
    });
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
        inList(
          taskDelivery.taskId,
          taskIds.map((each) => each.value),
        ),
      );

    return rows.map(toDelivery);
  }

  async ofTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<readonly TaskDelivery[]> {
    const rows = await this.context.db
      .select()
      .from(taskDelivery)
      .where(
        and(
          eq(taskDelivery.workspaceId, workspaceId.value),
          eq(taskDelivery.teamId, teamId.value),
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
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(taskDelivery)
        .where(eq(taskDelivery.taskId, taskId.value));

      await this.facts.refresh({ kind: 'tasks', taskIds: [taskId.value] });
    });
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.inTransaction(async () => {
      const removed = await this.context.db
        .delete(taskDelivery)
        .where(
          and(
            eq(taskDelivery.workspaceId, workspaceId.value),
            eq(taskDelivery.teamId, teamId.value),
          ),
        )
        .returning({ taskId: taskDelivery.taskId });

      await this.facts.deleteDeliveries({
        kind: 'tasks',
        workspaceId: workspaceId.value,
        taskIds: removed.map((each) => each.taskId),
      });
    });
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(taskDelivery)
        .where(eq(taskDelivery.workspaceId, workspaceId.value));

      await this.facts.deleteDeliveries({
        kind: 'workspace',
        workspaceId: workspaceId.value,
      });
    });
  }
}
