import { Injectable } from '@nestjs/common';
import { TaskFailures } from '@outcomes/domain/aggregates/task-failures.aggregate';
import { TaskFailuresMovedOnError } from '@outcomes/domain/exceptions/task-failures-moved-on.error';
import type { TeamWindow } from '@outcomes/domain/repositories/run-record.repository';
import type { TaskFailuresRepository } from '@outcomes/domain/repositories/task-failures.repository';
import { FailureOccurrence } from '@outcomes/domain/value-objects/failure-occurrence.vo';
import { taskFailures } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, gte } from 'drizzle-orm';

type FailuresRow = typeof taskFailures.$inferSelect;

const toFailures = (row: FailuresRow): TaskFailures =>
  TaskFailures.rehydrate({
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    occurrences: row.occurrences.map((each) =>
      FailureOccurrence.of({ ...each, at: new Date(each.at) }),
    ),
    version: row.version,
  });

const columnsOf = (failures: TaskFailures) => ({
  occurrences: failures.occurrences.map((each) => ({
    stationId: each.stationId,
    runId: each.runId,
    source: each.source,
    code: each.code,
    occurrences: each.occurrences,
    at: each.at.toISOString(),
  })),
  lastAt: failures.lastAt,
});

@Injectable()
export class DrizzleTaskFailuresRepository implements TaskFailuresRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: TaskFailures): Promise<void> {
    const written = await this.context.db
      .insert(taskFailures)
      .values({
        taskId: added.taskId.value,
        workspaceId: added.workspaceId.value,
        teamId: added.teamId.value,
        version: added.version,
        ...columnsOf(added),
      })
      .onConflictDoNothing({ target: taskFailures.taskId })
      .returning({ taskId: taskFailures.taskId });

    if (written.length === 0) {
      throw new TaskFailuresMovedOnError(added.taskId.value);
    }
  }

  async save(saved: TaskFailures): Promise<void> {
    const written = await this.context.db
      .update(taskFailures)
      .set({ version: saved.version + 1, ...columnsOf(saved) })
      .where(
        and(
          eq(taskFailures.taskId, saved.taskId.value),
          eq(taskFailures.version, saved.version),
        ),
      )
      .returning({ taskId: taskFailures.taskId });

    if (written.length === 0) {
      throw new TaskFailuresMovedOnError(saved.taskId.value);
    }
  }

  async of(taskId: TaskId): Promise<TaskFailures | null> {
    const [row] = await this.context.db
      .select()
      .from(taskFailures)
      .where(eq(taskFailures.taskId, taskId.value))
      .limit(1);

    return row ? toFailures(row) : null;
  }

  async ofTeamBetween(
    window: TeamWindow,
    most: number,
  ): Promise<readonly TaskFailures[]> {
    const rows = await this.context.db
      .select()
      .from(taskFailures)
      .where(
        and(
          eq(taskFailures.workspaceId, window.workspaceId.value),
          eq(taskFailures.teamId, window.teamId.value),
          gte(taskFailures.lastAt, window.from),
        ),
      )
      .orderBy(desc(taskFailures.lastAt), desc(taskFailures.taskId))
      .limit(most);

    return rows.map(toFailures);
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(taskFailures)
      .where(eq(taskFailures.taskId, taskId.value));
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(taskFailures)
      .where(
        and(
          eq(taskFailures.workspaceId, workspaceId.value),
          eq(taskFailures.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(taskFailures)
      .where(eq(taskFailures.workspaceId, workspaceId.value));
  }
}
