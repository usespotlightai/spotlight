import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  DueRetake,
  TurnRetakeClaim,
  TurnRetakesPort,
} from '@work/application/ports/turn-retakes.port';
import { turnRetake } from '@work/infrastructure/persistence/drizzle/schemas/turn-retake.schema';
import { and, asc, eq, lt } from 'drizzle-orm';

@Injectable()
export class DrizzleTurnRetakes implements TurnRetakesPort {
  constructor(private readonly context: DrizzleContext) {}

  async checkedAt(runId: RunId, suspendedAt: Date): Promise<Date | null> {
    const [found] = await this.context.db
      .select({ checkedAt: turnRetake.checkedAt })
      .from(turnRetake)
      .where(this.turn(runId, suspendedAt));

    return found?.checkedAt ?? null;
  }

  async claim(claim: TurnRetakeClaim): Promise<boolean> {
    const { runId, suspendedAt, attempt, from, to, retakes } = claim;
    const claimed = from
      ? await this.context.db
          .update(turnRetake)
          .set({
            checkedAt: to,
            attempt,
            ...(retakes ? { retakeDue: true } : {}),
          })
          .where(
            and(this.turn(runId, suspendedAt), eq(turnRetake.checkedAt, from)),
          )
          .returning({ runId: turnRetake.runId })
      : await this.context.db
          .insert(turnRetake)
          .values({
            runId: runId.value,
            suspendedAt,
            attempt,
            checkedAt: to,
            retakeDue: retakes,
          })
          .onConflictDoNothing()
          .returning({ runId: turnRetake.runId });

    return claimed.length > 0;
  }

  async due(limit: number): Promise<readonly DueRetake[]> {
    const rows = await this.context.db
      .select({
        runId: turnRetake.runId,
        suspendedAt: turnRetake.suspendedAt,
        attempt: turnRetake.attempt,
        checkedAt: turnRetake.checkedAt,
      })
      .from(turnRetake)
      .where(eq(turnRetake.retakeDue, true))
      .orderBy(asc(turnRetake.suspendedAt), asc(turnRetake.runId))
      .limit(limit);

    return rows.map((row) => ({ ...row, runId: RunId.of(row.runId) }));
  }

  async retaken(retake: DueRetake): Promise<void> {
    await this.context.db
      .update(turnRetake)
      .set({ retakeDue: false })
      .where(
        and(
          this.turn(retake.runId, retake.suspendedAt),
          eq(turnRetake.checkedAt, retake.checkedAt),
        ),
      );
  }

  async forgetSuspendedBefore(before: Date): Promise<void> {
    await this.context.db
      .delete(turnRetake)
      .where(lt(turnRetake.suspendedAt, before));
  }

  private turn(runId: RunId, suspendedAt: Date) {
    return and(
      eq(turnRetake.runId, runId.value),
      eq(turnRetake.suspendedAt, suspendedAt),
    );
  }
}
