import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  DueRetake,
  DueRetakeLease,
  TurnRetakeClaim,
  TurnRetakesPort,
} from '@work/application/ports/turn-retakes.port';
import { turnRetake } from '@work/infrastructure/persistence/drizzle/schemas/turn-retake.schema';
import { and, asc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm';

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
            ...(retakes
              ? {
                  retakeDue: true,
                  retakeTries: 0,
                  retakeLeasedUntil: null,
                  retakeLeaseToken: null,
                }
              : {}),
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

  async leaseNextDue(lease: DueRetakeLease): Promise<DueRetake | null> {
    const due = this.context.db
      .select({ runId: turnRetake.runId, suspendedAt: turnRetake.suspendedAt })
      .from(turnRetake)
      .where(
        and(
          eq(turnRetake.retakeDue, true),
          lt(turnRetake.retakeTries, lease.maxTries),
          or(
            isNull(turnRetake.retakeLeasedUntil),
            lte(turnRetake.retakeLeasedUntil, lease.now),
          ),
        ),
      )
      .orderBy(asc(turnRetake.suspendedAt), asc(turnRetake.runId))
      .limit(1)
      .for('update', { skipLocked: true });

    const [leased] = await this.context.db
      .update(turnRetake)
      .set({
        retakeLeasedUntil: lease.leasedUntil,
        retakeLeaseToken: lease.token,
        retakeTries: sql`${turnRetake.retakeTries} + 1`,
      })
      .where(sql`(${turnRetake.runId}, ${turnRetake.suspendedAt}) in ${due}`)
      .returning({
        runId: turnRetake.runId,
        suspendedAt: turnRetake.suspendedAt,
        attempt: turnRetake.attempt,
        tries: turnRetake.retakeTries,
      });

    return leased
      ? { ...leased, runId: RunId.of(leased.runId), leaseToken: lease.token }
      : null;
  }

  async retaken(retake: DueRetake): Promise<void> {
    await this.context.db
      .update(turnRetake)
      .set({
        retakeDue: false,
        retakeLeasedUntil: null,
        retakeLeaseToken: null,
      })
      .where(this.leasedBy(retake));
  }

  async retakeFailed(retake: DueRetake, retryAt: Date): Promise<void> {
    await this.context.db
      .update(turnRetake)
      .set({ retakeLeasedUntil: retryAt, retakeLeaseToken: null })
      .where(this.leasedBy(retake));
  }

  async forgetSuspendedBefore(before: Date): Promise<void> {
    await this.context.db
      .delete(turnRetake)
      .where(lt(turnRetake.suspendedAt, before));
  }

  private leasedBy(retake: DueRetake) {
    return and(
      this.turn(retake.runId, retake.suspendedAt),
      eq(turnRetake.retakeLeaseToken, retake.leaseToken),
    );
  }

  private turn(runId: RunId, suspendedAt: Date) {
    return and(
      eq(turnRetake.runId, runId.value),
      eq(turnRetake.suspendedAt, suspendedAt),
    );
  }
}
