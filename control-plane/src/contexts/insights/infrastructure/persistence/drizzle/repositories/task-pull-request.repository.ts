import { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import { TaskPullRequestVersionConflictError } from '@insights/domain/exceptions/task-pull-request-version-conflict.error';
import type { TaskPullRequestRepository } from '@insights/domain/repositories/task-pull-request.repository';
import { DrizzleRunFactProjection } from '@insights/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { taskPullRequest } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Inject, Injectable } from '@nestjs/common';
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

type TaskPullRequestRow = typeof taskPullRequest.$inferSelect;

const toTaskPullRequest = (row: TaskPullRequestRow): TaskPullRequest =>
  TaskPullRequest.rehydrate({
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

const columnsOf = (taskPullRequest: TaskPullRequest) => ({
  pullRequest: taskPullRequest.pullRequest.value,
  state: taskPullRequest.state,
  openedAt: taskPullRequest.openedAt,
  firstReviewAt: taskPullRequest.firstReviewAt,
  closedAt: taskPullRequest.closedAt,
});

@Injectable()
export class DrizzleTaskPullRequestRepository
  implements TaskPullRequestRepository
{
  constructor(
    private readonly context: DrizzleContext,
    private readonly facts: DrizzleRunFactProjection,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: TaskPullRequest): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(taskPullRequest)
        .values({
          taskId: added.taskId.value,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId.value,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({ target: taskPullRequest.taskId })
        .returning({ taskId: taskPullRequest.taskId });

      if (written.length === 0) {
        throw new TaskPullRequestVersionConflictError(added.taskId.value);
      }

      await this.facts.refresh({
        kind: 'tasks',
        taskIds: [added.taskId.value],
      });

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: TaskPullRequest): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(taskPullRequest)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            eq(taskPullRequest.taskId, saved.taskId.value),
            eq(taskPullRequest.version, saved.version),
          ),
        )
        .returning({ taskId: taskPullRequest.taskId });

      if (written.length === 0) {
        throw new TaskPullRequestVersionConflictError(saved.taskId.value);
      }

      await this.facts.refresh({
        kind: 'tasks',
        taskIds: [saved.taskId.value],
      });

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async forTask(taskId: TaskId): Promise<TaskPullRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(taskPullRequest)
      .where(eq(taskPullRequest.taskId, taskId.value))
      .limit(1);

    return row ? toTaskPullRequest(row) : null;
  }

  async forTasks(
    taskIds: readonly TaskId[],
  ): Promise<readonly TaskPullRequest[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(taskPullRequest)
      .where(
        inList(
          taskPullRequest.taskId,
          taskIds.map((each) => each.value),
        ),
      );

    return rows.map(toTaskPullRequest);
  }

  async ofTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<readonly TaskPullRequest[]> {
    const rows = await this.context.db
      .select()
      .from(taskPullRequest)
      .where(
        and(
          eq(taskPullRequest.workspaceId, workspaceId.value),
          eq(taskPullRequest.teamId, teamId.value),
        ),
      );

    return rows.map(toTaskPullRequest);
  }

  async forPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskPullRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(taskPullRequest)
      .where(
        and(
          eq(taskPullRequest.workspaceId, workspaceId.value),
          eq(taskPullRequest.pullRequest, pullRequest.value),
        ),
      )
      .limit(1);

    return row ? toTaskPullRequest(row) : null;
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(taskPullRequest)
        .where(eq(taskPullRequest.taskId, taskId.value));

      await this.facts.refresh({ kind: 'tasks', taskIds: [taskId.value] });
    });
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.inTransaction(async () => {
      const removed = await this.context.db
        .delete(taskPullRequest)
        .where(
          and(
            eq(taskPullRequest.workspaceId, workspaceId.value),
            eq(taskPullRequest.teamId, teamId.value),
          ),
        )
        .returning({ taskId: taskPullRequest.taskId });

      await this.facts.deleteTaskPullRequests({
        kind: 'tasks',
        workspaceId: workspaceId.value,
        taskIds: removed.map((each) => each.taskId),
      });
    });
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .delete(taskPullRequest)
        .where(eq(taskPullRequest.workspaceId, workspaceId.value));

      await this.facts.deleteTaskPullRequests({
        kind: 'workspace',
        workspaceId: workspaceId.value,
      });
    });
  }
}
