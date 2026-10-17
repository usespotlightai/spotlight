import { Injectable } from '@nestjs/common';
import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type { PullRequestTombstone } from '@outcomes/domain/services/pull-request-tombstone';
import {
  forgottenPullRequest,
  forgottenTask,
  forgottenTeam,
  forgottenWorkspace,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';

const workspaceKey = (workspaceId: WorkspaceId): string =>
  `outcomes-workspace:${workspaceId.value}`;

const teamKey = (workspaceId: WorkspaceId, teamId: TeamId): string =>
  `outcomes-team:${workspaceId.value}:${teamId.value}`;

const taskKey = (taskId: TaskId): string => `outcomes-task:${taskId.value}`;

const pullRequestKey = (
  workspaceId: WorkspaceId,
  pullRequest: PullRequestUrl,
): string => `outcomes-pull-request:${workspaceId.value}:${pullRequest.value}`;

@Injectable()
export class DrizzleForgotten implements ForgottenPort {
  constructor(private readonly context: DrizzleContext) {}

  async forgetTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    await this.lock(taskKey(taskId));
    await this.context.db
      .insert(forgottenTask)
      .values({ taskId: taskId.value, workspaceId: workspaceId.value })
      .onConflictDoNothing();
  }

  async forgetTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.lock(teamKey(workspaceId, teamId));
    await this.context.db
      .insert(forgottenTeam)
      .values({ workspaceId: workspaceId.value, teamId: teamId.value })
      .onConflictDoNothing();
  }

  async forgetWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.lock(workspaceKey(workspaceId));
    await this.context.db
      .insert(forgottenWorkspace)
      .values({ workspaceId: workspaceId.value })
      .onConflictDoNothing();
    await this.context.db
      .delete(forgottenTask)
      .where(eq(forgottenTask.workspaceId, workspaceId.value));
    await this.context.db
      .delete(forgottenTeam)
      .where(eq(forgottenTeam.workspaceId, workspaceId.value));
    await this.context.db
      .delete(forgottenPullRequest)
      .where(eq(forgottenPullRequest.workspaceId, workspaceId.value));
  }

  async holding(
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

  async forgot(
    workspaceId: WorkspaceId,
    taskId: TaskId | null,
    teamId: TeamId | null = null,
  ): Promise<boolean> {
    const [workspace] = await this.context.db
      .select({ workspaceId: forgottenWorkspace.workspaceId })
      .from(forgottenWorkspace)
      .where(eq(forgottenWorkspace.workspaceId, workspaceId.value))
      .limit(1);

    if (workspace) {
      return true;
    }

    if (teamId) {
      const [team] = await this.context.db
        .select({ teamId: forgottenTeam.teamId })
        .from(forgottenTeam)
        .where(
          and(
            eq(forgottenTeam.workspaceId, workspaceId.value),
            eq(forgottenTeam.teamId, teamId.value),
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
      .select({ taskId: forgottenTask.taskId })
      .from(forgottenTask)
      .where(eq(forgottenTask.taskId, taskId.value))
      .limit(1);

    return task !== undefined;
  }

  async holdingPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void> {
    await this.lock(pullRequestKey(workspaceId, pullRequest));
  }

  async forgetPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    tombstone: PullRequestTombstone,
  ): Promise<void> {
    await this.context.db
      .insert(forgottenPullRequest)
      .values({
        workspaceId: workspaceId.value,
        pullRequest: pullRequest.value,
        updatedAt: tombstone.updatedAt,
      })
      .onConflictDoUpdate({
        target: [
          forgottenPullRequest.workspaceId,
          forgottenPullRequest.pullRequest,
        ],
        set: {
          updatedAt: sql`greatest(${forgottenPullRequest.updatedAt}, excluded.updated_at)`,
        },
      });
  }

  async tombstoneOf(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<PullRequestTombstone | null> {
    const [found] = await this.context.db
      .select({ updatedAt: forgottenPullRequest.updatedAt })
      .from(forgottenPullRequest)
      .where(
        and(
          eq(forgottenPullRequest.workspaceId, workspaceId.value),
          eq(forgottenPullRequest.pullRequest, pullRequest.value),
        ),
      )
      .limit(1);

    return found ?? null;
  }

  async dropTombstonesBefore(before: Date, max: number): Promise<number> {
    const expired = this.context.db
      .select({
        workspaceId: forgottenPullRequest.workspaceId,
        pullRequest: forgottenPullRequest.pullRequest,
      })
      .from(forgottenPullRequest)
      .where(lt(forgottenPullRequest.updatedAt, before))
      .limit(max);
    const dropped = await this.context.db
      .delete(forgottenPullRequest)
      .where(
        inArray(
          sql`(${forgottenPullRequest.workspaceId}, ${forgottenPullRequest.pullRequest})`,
          expired,
        ),
      )
      .returning({ pullRequest: forgottenPullRequest.pullRequest });

    return dropped.length;
  }

  private async lock(key: string): Promise<void> {
    this.refuseOutsideTransaction();
    await this.context.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
    );
  }

  private async share(key: string): Promise<void> {
    this.refuseOutsideTransaction();
    await this.context.db.execute(
      sql`select pg_advisory_xact_lock_shared(hashtextextended(${key}, 0))`,
    );
  }

  private refuseOutsideTransaction(): void {
    if (!this.context.transacting) {
      throw new Error('Holding what outcomes forgot needs a transaction');
    }
  }
}
