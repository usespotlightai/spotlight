import { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import { TaskFailuresVersionConflictError } from '@insights/domain/exceptions/task-failures-version-conflict.error';
import type { TaskFailuresRepository } from '@insights/domain/repositories/task-failures.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import { taskFailures } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { Erased } from '@shared-kernel/domain/erased';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type FailuresRow = typeof taskFailures.$inferSelect;

const toFailures = (row: FailuresRow): TaskFailures =>
  TaskFailures.rehydrate({
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    occurrences: row.occurrences.map((each) =>
      FailureOccurrence.of({
        ...each,
        stationId: StationId.of(each.stationId),
        at: new Date(each.at),
      }),
    ),
    version: row.version,
  });

const columnsOf = (failures: TaskFailures) => ({
  occurrences: failures.occurrences.map((each) => ({
    stationId: each.stationId.value,
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
      throw new TaskFailuresVersionConflictError(added.taskId.value);
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
      throw new TaskFailuresVersionConflictError(saved.taskId.value);
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

  async remove(removed: Erased<TaskFailures>): Promise<void> {
    const gone = await this.context.db
      .delete(taskFailures)
      .where(
        and(
          eq(taskFailures.taskId, removed.taskId.value),
          eq(taskFailures.version, removed.version),
        ),
      )
      .returning({ taskId: taskFailures.taskId });

    if (gone.length === 0) {
      throw new TaskFailuresVersionConflictError(removed.taskId.value);
    }
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly TaskFailures[]> {
    const rows = await this.context.db
      .select()
      .from(taskFailures)
      .where(inScope(taskFailures, scope))
      .limit(max);

    return rows.map(toFailures);
  }
}
