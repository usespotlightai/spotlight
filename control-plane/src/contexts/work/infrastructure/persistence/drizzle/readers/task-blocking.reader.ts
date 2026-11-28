import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskBlockingPort } from '@work/application/ports/task-blocking.port';
import { BlockingGraph } from '@work/domain/services/blocking-graph';
import { sql } from 'drizzle-orm';

interface ReachableRow extends Record<string, unknown> {
  readonly id: string;
  readonly blocked_by: readonly string[];
}

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

  async graphFrom(
    workspaceId: WorkspaceId,
    blockers: readonly TaskId[],
  ): Promise<BlockingGraph> {
    if (blockers.length === 0) {
      return BlockingGraph.empty();
    }

    const result = await this.context.db.execute<ReachableRow>(sql`
      with recursive reachable(id, blocked_by) as (
        select id, blocked_by
        from task
        where workspace_id = ${workspaceId.value}
          and id = any(${sql.param(blockers.map((each) => each.value))}::text[])
        union
        select waited.id, waited.blocked_by
        from task waited
        join reachable on waited.id = any(reachable.blocked_by)
        where waited.workspace_id = ${workspaceId.value}
      )
      select id, blocked_by from reachable where cardinality(blocked_by) > 0
    `);

    return BlockingGraph.of(
      result.rows.map((row) => ({
        task: TaskId.of(row.id),
        blockedBy: row.blocked_by.map((each) => TaskId.of(each)),
      })),
    );
  }
}
