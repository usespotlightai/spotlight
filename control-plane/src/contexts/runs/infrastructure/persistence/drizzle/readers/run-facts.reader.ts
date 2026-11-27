import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunFactsReaderPort } from '@runs/application/ports/run-facts-reader.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import type { RequesterOwner } from '@runs/domain/value-objects/run-requester.vo';
import type { RunTurnState } from '@runs/domain/value-objects/run-turn.vo';
import type { QueuedRunWait } from '@runs/domain/value-objects/run-waiting';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { toRun } from '@runs/infrastructure/persistence/drizzle/repositories/run.repository';
import { toArchive } from '@runs/infrastructure/persistence/drizzle/repositories/working-copy-archive.repository';
import {
  run,
  runWait,
} from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { workingCopyArchive } from '@runs/infrastructure/persistence/drizzle/schemas/working-copy-archive.schema';
import { firstOf } from '@shared-kernel/domain/item-at';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  lt,
  or,
} from 'drizzle-orm';

@Injectable()
export class DrizzleRunFactsReader implements RunFactsReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async runs(ids: readonly RunId[]): Promise<readonly Run[]> {
    const wanted = [...new Set(ids.map((each) => each.value))];

    if (wanted.length === 0) {
      return [];
    }

    const rows = await this.selected().where(inArray(run.id, wanted));

    return rows.map(toRun);
  }

  async waits(
    ids: readonly RunId[],
  ): Promise<readonly (QueuedRunWait & { readonly runId: RunId })[]> {
    const wanted = [...new Set(ids.map((each) => each.value))];

    if (wanted.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(runWait)
      .where(inArray(runWait.runId, wanted));

    return rows.map((row) => ({
      runId: RunId.of(row.runId),
      reason: row.reason,
      quiet:
        row.reason === 'hosts-offline'
          ? { hosts: row.quietHosts ?? [], since: row.quietSince }
          : null,
      queuedAt: row.queuedAt,
      since: row.since,
    }));
  }

  async archives(
    ids: readonly WorkingCopyArchiveId[],
  ): Promise<readonly WorkingCopyArchive[]> {
    const wanted = [...new Set(ids.map((each) => each.value))];

    if (wanted.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(workingCopyArchive)
      .where(inArray(workingCopyArchive.id, wanted));

    return rows.map(toArchive);
  }

  async newestCompletedOfTeam(
    team: TeamId,
    owner: string,
  ): Promise<RunId | null> {
    const row = firstOf(
      await this.context.db
        .select({ id: run.id })
        .from(run)
        .where(
          and(
            eq(run.teamId, team.value),
            eq(run.requesterOwner, owner),
            eq(run.state, 'completed'),
          ),
        )
        .orderBy(desc(run.createdAt), desc(run.id))
        .limit(1),
    );

    return row ? RunId.of(row.id) : null;
  }

  async newestArchiveOf(runId: RunId): Promise<WorkingCopyArchive | null> {
    const row = firstOf(
      await this.context.db
        .select()
        .from(workingCopyArchive)
        .where(
          and(
            eq(workingCopyArchive.grantedToRunId, runId.value),
            isNotNull(workingCopyArchive.completedAt),
          ),
        )
        .orderBy(desc(workingCopyArchive.completedAt))
        .limit(1),
    );

    return row ? toArchive(row) : null;
  }

  async turnsSuspendedBefore(
    owner: RequesterOwner,
    turn: RunTurnState,
    before: Date,
    after: { readonly suspendedAt: Date; readonly id: RunId } | null,
    max: number,
  ): Promise<readonly Run[]> {
    const rows = await this.selected()
      .where(
        and(
          eq(run.turn, turn),
          eq(run.requesterOwner, owner.value),
          lt(run.suspendedAt, before),
          after
            ? or(
                gt(run.suspendedAt, after.suspendedAt),
                and(
                  eq(run.suspendedAt, after.suspendedAt),
                  gt(run.id, after.id.value),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(run.suspendedAt), asc(run.id))
      .limit(max);

    return rows.map(toRun);
  }

  private selected() {
    return this.context.db.select({ run }).from(run);
  }
}
