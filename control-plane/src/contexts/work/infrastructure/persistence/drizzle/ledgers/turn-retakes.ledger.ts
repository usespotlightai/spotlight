import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TurnRetakesPort } from '@work/application/ports/turn-retakes.port';
import { turnRetake } from '@work/infrastructure/persistence/drizzle/schemas/turn-retake.schema';
import { and, eq, lt } from 'drizzle-orm';

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

  async advance(
    runId: RunId,
    suspendedAt: Date,
    from: Date | null,
    to: Date,
  ): Promise<boolean> {
    const advanced = from
      ? await this.context.db
          .update(turnRetake)
          .set({ checkedAt: to })
          .where(
            and(this.turn(runId, suspendedAt), eq(turnRetake.checkedAt, from)),
          )
          .returning({ runId: turnRetake.runId })
      : await this.context.db
          .insert(turnRetake)
          .values({ runId: runId.value, suspendedAt, checkedAt: to })
          .onConflictDoNothing()
          .returning({ runId: turnRetake.runId });

    return advanced.length > 0;
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
