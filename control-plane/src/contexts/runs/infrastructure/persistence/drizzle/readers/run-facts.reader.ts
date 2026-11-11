import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunFactsReaderPort } from '@runs/application/ports/run-facts-reader.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import type { RequesterOwner } from '@runs/domain/value-objects/run-requester.vo';
import type { RunTurnState } from '@runs/domain/value-objects/run-turn.vo';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { toRun } from '@runs/infrastructure/persistence/drizzle/repositories/run.repository';
import { toArchive } from '@runs/infrastructure/persistence/drizzle/repositories/working-copy-archive.repository';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { workingCopyArchive } from '@runs/infrastructure/persistence/drizzle/schemas/working-copy-archive.schema';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { and, asc, eq, gt, inArray, lt, or } from 'drizzle-orm';

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
