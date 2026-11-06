import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { StartingPointHold } from '@work/domain/aggregates/starting-point-hold.aggregate';
import { StartingPointHoldVersionConflictError } from '@work/domain/exceptions/starting-point-hold-version-conflict.error';
import type { StartingPointHoldRepository } from '@work/domain/repositories/starting-point-hold.repository';
import {
  startingPointHold,
  startingPointHoldRun,
} from '@work/infrastructure/persistence/drizzle/schemas/starting-point-hold.schema';
import { and, asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleStartingPointHoldRepository
  implements StartingPointHoldRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async find(holder: string): Promise<StartingPointHold | null> {
    const [row] = await this.context.db
      .select()
      .from(startingPointHold)
      .where(eq(startingPointHold.holder, holder))
      .limit(1);

    if (!row) {
      return null;
    }

    const runs = await this.context.db
      .select({ runId: startingPointHoldRun.runId })
      .from(startingPointHoldRun)
      .where(eq(startingPointHoldRun.holder, holder))
      .orderBy(asc(startingPointHoldRun.runId));

    return StartingPointHold.rehydrate({
      holder: row.holder,
      workspaceId: WorkspaceId.of(row.workspaceId),
      runs: runs.map((each) => RunId.of(each.runId)),
      version: row.version,
    });
  }

  async add(hold: StartingPointHold): Promise<void> {
    if (hold.isReleased) {
      return;
    }

    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(startingPointHold)
        .values({
          holder: hold.holder,
          workspaceId: hold.workspaceId.value,
          version: hold.version,
        })
        .onConflictDoNothing({ target: startingPointHold.holder })
        .returning({ holder: startingPointHold.holder });

      if (written.length === 0) {
        throw new StartingPointHoldVersionConflictError(hold.holder);
      }

      await this.heldRuns(hold);
    });
  }

  async save(hold: StartingPointHold): Promise<void> {
    await this.context.inTransaction(async () => {
      const at = and(
        eq(startingPointHold.holder, hold.holder),
        eq(startingPointHold.version, hold.version),
      );
      const written = hold.isReleased
        ? await this.context.db
            .delete(startingPointHold)
            .where(at)
            .returning({ holder: startingPointHold.holder })
        : await this.context.db
            .update(startingPointHold)
            .set({ version: hold.version + 1 })
            .where(at)
            .returning({ holder: startingPointHold.holder });

      if (written.length === 0) {
        throw new StartingPointHoldVersionConflictError(hold.holder);
      }

      if (!hold.isReleased) {
        await this.context.db
          .delete(startingPointHoldRun)
          .where(eq(startingPointHoldRun.holder, hold.holder));
        await this.heldRuns(hold);
      }
    });
  }

  private async heldRuns(hold: StartingPointHold): Promise<void> {
    if (hold.runs.length === 0) {
      return;
    }

    await this.context.db.insert(startingPointHoldRun).values(
      hold.runs.map((each) => ({
        holder: hold.holder,
        workspaceId: hold.workspaceId.value,
        runId: each.value,
      })),
    );
  }
}
