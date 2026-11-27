import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskBlockingPort } from '@work/application/ports/task-blocking.port';
import { BlockingGraph } from '@work/domain/services/blocking-graph';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, eq, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleTaskBlocking implements TaskBlockingPort {
  constructor(private readonly context: DrizzleContext) {}

  async lockIn(workspaceId: WorkspaceId): Promise<void> {
    if (!this.context.transacting) {
      throw new InconsistentStateError(
        'lock on what blocks what',
        'was asked for outside a transaction',
      );
    }

    await this.context.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`task-blocking:${workspaceId.value}`}, 0))`,
    );
  }

  async graphIn(workspaceId: WorkspaceId): Promise<BlockingGraph> {
    const rows = await this.context.db
      .select({ id: task.id, blockedBy: task.blockedBy })
      .from(task)
      .where(
        and(
          eq(task.workspaceId, workspaceId.value),
          sql`cardinality(${task.blockedBy}) > 0`,
        ),
      );

    return BlockingGraph.of(
      rows.map((row) => ({
        task: TaskId.of(row.id),
        blockedBy: row.blockedBy.map((each) => TaskId.of(each)),
      })),
    );
  }
}
