import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { Tombstones } from '@insights/domain/value-objects/tombstones.vo';
import {
  deletedTask,
  deletedTeam,
  deletedWorkspace,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, sql } from 'drizzle-orm';

const workspaceKey = (workspaceId: WorkspaceId): string =>
  `insights-workspace:${workspaceId.value}`;

const teamKey = (workspaceId: WorkspaceId, teamId: TeamId): string =>
  `insights-team:${workspaceId.value}:${teamId.value}`;

const taskKey = (taskId: TaskId): string => `insights-task:${taskId.value}`;

@Injectable()
export class DrizzleDeletions implements DeletionsPort {
  constructor(private readonly context: DrizzleContext) {}

  async markDeleted(scope: DeletionScope): Promise<void> {
    switch (scope.kind) {
      case 'task':
        await this.lock(taskKey(scope.taskId));
        await this.context.db
          .insert(deletedTask)
          .values({
            taskId: scope.taskId.value,
            workspaceId: scope.workspaceId.value,
          })
          .onConflictDoNothing();
        return;
      case 'team':
        await this.lock(teamKey(scope.workspaceId, scope.teamId));
        await this.context.db
          .insert(deletedTeam)
          .values({
            workspaceId: scope.workspaceId.value,
            teamId: scope.teamId.value,
          })
          .onConflictDoNothing();
        return;
      case 'workspace':
        await this.lock(workspaceKey(scope.workspaceId));
        await this.context.db
          .insert(deletedWorkspace)
          .values({ workspaceId: scope.workspaceId.value })
          .onConflictDoNothing();
        await this.context.db
          .delete(deletedTask)
          .where(eq(deletedTask.workspaceId, scope.workspaceId.value));
        await this.context.db
          .delete(deletedTeam)
          .where(eq(deletedTeam.workspaceId, scope.workspaceId.value));
        return;
    }
  }

  async tombstonesOf(owner: FactOwner): Promise<Tombstones> {
    await this.share(workspaceKey(owner.workspaceId));

    if (owner.teamId) {
      await this.share(teamKey(owner.workspaceId, owner.teamId));
    }

    if (owner.taskId) {
      await this.lock(taskKey(owner.taskId));
    }

    return Tombstones.of({
      workspace: await this.workspaceDeleted(owner.workspaceId),
      team:
        owner.teamId !== null &&
        (await this.teamDeleted(owner.workspaceId, owner.teamId)),
      task: owner.taskId !== null && (await this.taskDeleted(owner.taskId)),
    });
  }

  private async workspaceDeleted(workspaceId: WorkspaceId): Promise<boolean> {
    const [found] = await this.context.db
      .select({ workspaceId: deletedWorkspace.workspaceId })
      .from(deletedWorkspace)
      .where(eq(deletedWorkspace.workspaceId, workspaceId.value))
      .limit(1);

    return found !== undefined;
  }

  private async teamDeleted(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<boolean> {
    const [found] = await this.context.db
      .select({ teamId: deletedTeam.teamId })
      .from(deletedTeam)
      .where(
        and(
          eq(deletedTeam.workspaceId, workspaceId.value),
          eq(deletedTeam.teamId, teamId.value),
        ),
      )
      .limit(1);

    return found !== undefined;
  }

  private async taskDeleted(taskId: TaskId): Promise<boolean> {
    const [found] = await this.context.db
      .select({ taskId: deletedTask.taskId })
      .from(deletedTask)
      .where(eq(deletedTask.taskId, taskId.value))
      .limit(1);

    return found !== undefined;
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
