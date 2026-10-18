import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { PullRequestTombstone } from '@insights/domain/services/pull-request-tombstone';
import {
  deletedPullRequest,
  deletedTask,
  deletedTeam,
  deletedWorkspace,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';

const workspaceKey = (workspaceId: WorkspaceId): string =>
  `insights-workspace:${workspaceId.value}`;

const teamKey = (workspaceId: WorkspaceId, teamId: TeamId): string =>
  `insights-team:${workspaceId.value}:${teamId.value}`;

const taskKey = (taskId: TaskId): string => `insights-task:${taskId.value}`;

const pullRequestKey = (
  workspaceId: WorkspaceId,
  pullRequest: PullRequestUrl,
): string => `insights-pull-request:${workspaceId.value}:${pullRequest.value}`;

@Injectable()
export class DrizzleDeletions implements DeletionsPort {
  constructor(private readonly context: DrizzleContext) {}

  async deleteTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    await this.lock(taskKey(taskId));
    await this.context.db
      .insert(deletedTask)
      .values({ taskId: taskId.value, workspaceId: workspaceId.value })
      .onConflictDoNothing();
  }

  async deleteTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.lock(teamKey(workspaceId, teamId));
    await this.context.db
      .insert(deletedTeam)
      .values({ workspaceId: workspaceId.value, teamId: teamId.value })
      .onConflictDoNothing();
  }

  async deleteWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.lock(workspaceKey(workspaceId));
    await this.context.db
      .insert(deletedWorkspace)
      .values({ workspaceId: workspaceId.value })
      .onConflictDoNothing();
    await this.context.db
      .delete(deletedTask)
      .where(eq(deletedTask.workspaceId, workspaceId.value));
    await this.context.db
      .delete(deletedTeam)
      .where(eq(deletedTeam.workspaceId, workspaceId.value));
    await this.context.db
      .delete(deletedPullRequest)
      .where(eq(deletedPullRequest.workspaceId, workspaceId.value));
  }

  async lockDeletion(
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    teamId: TeamId | null = null,
  ): Promise<void> {
    await this.share(workspaceKey(workspaceId));

    if (teamId) {
      await this.share(teamKey(workspaceId, teamId));
    }

    if (taskId) {
      await this.lock(taskKey(taskId));
    }
  }

  async isDeleted(
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    teamId: TeamId | null = null,
  ): Promise<boolean> {
    const [workspace] = await this.context.db
      .select({ workspaceId: deletedWorkspace.workspaceId })
      .from(deletedWorkspace)
      .where(eq(deletedWorkspace.workspaceId, workspaceId.value))
      .limit(1);

    if (workspace) {
      return true;
    }

    if (teamId) {
      const [team] = await this.context.db
        .select({ teamId: deletedTeam.teamId })
        .from(deletedTeam)
        .where(
          and(
            eq(deletedTeam.workspaceId, workspaceId.value),
            eq(deletedTeam.teamId, teamId.value),
          ),
        )
        .limit(1);

      if (team) {
        return true;
      }
    }

    if (!taskId) {
      return false;
    }

    const [task] = await this.context.db
      .select({ taskId: deletedTask.taskId })
      .from(deletedTask)
      .where(eq(deletedTask.taskId, taskId.value))
      .limit(1);

    return task !== undefined;
  }

  async lockPullRequestDeletion(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void> {
    await this.lock(pullRequestKey(workspaceId, pullRequest));
  }

  async deletePullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    tombstone: PullRequestTombstone,
  ): Promise<void> {
    await this.context.db
      .insert(deletedPullRequest)
      .values({
        workspaceId: workspaceId.value,
        pullRequest: pullRequest.value,
        updatedAt: tombstone.updatedAt,
      })
      .onConflictDoUpdate({
        target: [
          deletedPullRequest.workspaceId,
          deletedPullRequest.pullRequest,
        ],
        set: {
          updatedAt: sql`greatest(${deletedPullRequest.updatedAt}, excluded.updated_at)`,
        },
      });
  }

  async tombstoneOf(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<PullRequestTombstone | null> {
    const [found] = await this.context.db
      .select({ updatedAt: deletedPullRequest.updatedAt })
      .from(deletedPullRequest)
      .where(
        and(
          eq(deletedPullRequest.workspaceId, workspaceId.value),
          eq(deletedPullRequest.pullRequest, pullRequest.value),
        ),
      )
      .limit(1);

    return found ?? null;
  }

  async purgeTombstonesBefore(before: Date, max: number): Promise<number> {
    const expired = this.context.db
      .select({
        workspaceId: deletedPullRequest.workspaceId,
        pullRequest: deletedPullRequest.pullRequest,
      })
      .from(deletedPullRequest)
      .where(lt(deletedPullRequest.updatedAt, before))
      .limit(max);
    const dropped = await this.context.db
      .delete(deletedPullRequest)
      .where(
        inArray(
          sql`(${deletedPullRequest.workspaceId}, ${deletedPullRequest.pullRequest})`,
          expired,
        ),
      )
      .returning({ pullRequest: deletedPullRequest.pullRequest });

    return dropped.length;
  }

  private async lock(key: string): Promise<void> {
    this.assertInTransaction();
    await this.context.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
    );
  }

  private async share(key: string): Promise<void> {
    this.assertInTransaction();
    await this.context.db.execute(
      sql`select pg_advisory_xact_lock_shared(hashtextextended(${key}, 0))`,
    );
  }

  private assertInTransaction(): void {
    if (!this.context.transacting) {
      throw new Error('A lock on what Insights deleted needs a transaction');
    }
  }
}
