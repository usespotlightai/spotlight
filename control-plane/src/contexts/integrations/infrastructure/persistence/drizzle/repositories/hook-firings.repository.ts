import type {
  HookFiringsPort,
  NewFiring,
  StoredFiring,
} from '@integrations/application/ports/hook-firings.port';
import type { StepOutcome } from '@integrations/application/ports/hook-runtime.port';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import {
  HOOK_FAILURES,
  HookFailure,
  type HookFailureCode,
} from '@integrations/domain/value-objects/hook-failure.vo';
import {
  type HookFiringState,
  hookFiring,
} from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';

const REASON_LIMIT = 1_000;

const FINISHED: HookFiringState[] = ['done', 'failed', 'superseded'];

const held = (firing: StoredFiring) =>
  and(eq(hookFiring.id, firing.id), eq(hookFiring.claimedAt, firing.claimedAt));

const LEASE_MS = 10 * 60 * 1000;

const isCode = (code: string): code is HookFailureCode =>
  Object.keys(HOOK_FAILURES).includes(code);

const failureOf = (
  code: string | null,
  reason: string | null,
): HookFailure | null =>
  code && isCode(code) ? HookFailure.of(code, reason ?? '') : null;

@Injectable()
export class DrizzleHookFirings implements HookFiringsPort {
  constructor(private readonly context: DrizzleContext) {}

  async fire(firing: NewFiring): Promise<boolean> {
    const written = await this.context.db
      .insert(hookFiring)
      .values({
        id: firing.id,
        hookId: firing.hookId,
        workspaceId: firing.workspaceId,
        teamId: firing.teamId,
        taskId: firing.taskId,
        runId: firing.runId,
        stationKey: firing.stationKey,
        on: firing.on,
        occurrence: firing.occurrence,
        event: { ...firing.event },
        matched: firing.matched,
        cause: { ...firing.cause.stored },
        link: { ...firing.link },
        firedAt: firing.at,
        dueAt: firing.at,
      })
      .onConflictDoNothing()
      .returning({ id: hookFiring.id });

    return written.length > 0;
  }

  async claimNext(now: Date): Promise<StoredFiring | null> {
    const found = await this.context.run(async () => {
      const lapsed = new Date(now.getTime() - LEASE_MS);
      const [waiting] = await this.context.db
        .select()
        .from(hookFiring)
        .where(
          or(
            and(eq(hookFiring.state, 'pending'), lte(hookFiring.dueAt, now)),
            and(
              eq(hookFiring.state, 'working'),
              lt(hookFiring.claimedAt, lapsed),
            ),
          ),
        )
        .orderBy(asc(hookFiring.dueAt), asc(hookFiring.firedAt))
        .limit(1)
        .for('update', { skipLocked: true });

      if (waiting) {
        await this.context.db
          .update(hookFiring)
          .set({ state: 'working', claimedAt: now })
          .where(eq(hookFiring.id, waiting.id));
      }

      return waiting ? { ...waiting, claimedAt: now } : null;
    });

    if (!found) {
      return null;
    }

    return {
      id: found.id,
      hookId: found.hookId,
      workspaceId: found.workspaceId,
      teamId: found.teamId,
      taskId: found.taskId,
      runId: found.runId,
      stationKey: found.stationKey,
      on: found.on as HookEventName,
      occurrence: found.occurrence,
      at: found.firedAt,
      event: found.event,
      matched: found.matched,
      cause: CausalChain.read(found.cause),
      link: found.link,
      failure: failureOf(found.failure, found.failed),
      steps: found.steps as unknown as StepOutcome[],
      attempts: found.attempts,
      claimedAt: found.claimedAt,
    };
  }

  async stepped(
    firing: StoredFiring,
    steps: readonly StepOutcome[],
  ): Promise<boolean> {
    const written = await this.context.db
      .update(hookFiring)
      .set({ steps: steps.map((each) => ({ ...each })) })
      .where(held(firing))
      .returning({ id: hookFiring.id });

    return written.length > 0;
  }

  async matched(
    firing: StoredFiring,
    event: Readonly<Record<string, unknown>>,
  ): Promise<boolean> {
    const written = await this.context.db
      .update(hookFiring)
      .set({ event: { ...event }, matched: true })
      .where(held(firing))
      .returning({ id: hookFiring.id });

    return written.length > 0;
  }

  async worked(firing: StoredFiring, at: Date): Promise<void> {
    await this.context.db
      .update(hookFiring)
      .set({
        state: 'done',
        handledAt: at,
        attempts: sql`${hookFiring.attempts} + 1`,
      })
      .where(held(firing));
  }

  async waitAt(firing: StoredFiring, at: Date): Promise<void> {
    await this.context.db
      .update(hookFiring)
      .set({ state: 'pending', dueAt: at, claimedAt: null })
      .where(held(firing));
  }

  async stopping(firing: StoredFiring, failure: HookFailure): Promise<boolean> {
    const written = await this.context.db
      .update(hookFiring)
      .set({
        failure: failure.code,
        failed: failure.reason.slice(0, REASON_LIMIT),
      })
      .where(held(firing))
      .returning({ id: hookFiring.id });

    return written.length > 0;
  }

  async retryAt(
    firing: StoredFiring,
    failure: HookFailure,
    at: Date,
  ): Promise<void> {
    await this.context.db
      .update(hookFiring)
      .set({
        state: 'pending',
        dueAt: at,
        claimedAt: null,
        attempts: sql`${hookFiring.attempts} + 1`,
        failure: failure.code,
        failed: failure.reason.slice(0, REASON_LIMIT),
      })
      .where(held(firing));
  }

  async failed(
    firing: StoredFiring,
    failure: HookFailure,
    at: Date,
  ): Promise<void> {
    await this.context.db
      .update(hookFiring)
      .set({
        state: failure.code === 'superseded' ? 'superseded' : 'failed',
        handledAt: at,
        attempts: sql`${hookFiring.attempts} + 1`,
        failure: failure.code,
        failed: failure.reason.slice(0, REASON_LIMIT),
      })
      .where(held(firing));
  }

  async recentRepeats(firing: StoredFiring, since: Date): Promise<number> {
    const [row] = await this.context.db
      .select({ repeats: count() })
      .from(hookFiring)
      .where(
        and(
          eq(hookFiring.hookId, firing.hookId),
          eq(hookFiring.taskId, firing.taskId),
          gte(hookFiring.firedAt, since),
          or(
            lt(hookFiring.firedAt, firing.at),
            and(
              eq(hookFiring.firedAt, firing.at),
              lt(hookFiring.id, firing.id),
            ),
          ),
          sql`${hookFiring.link}->>'key' = ${firing.link.key}`,
        ),
      );

    return row?.repeats ?? 0;
  }

  async chainOf(
    workspaceId: string,
    firingId: string,
  ): Promise<CausalChain | null> {
    const [row] = await this.context.db
      .select({ cause: hookFiring.cause, link: hookFiring.link })
      .from(hookFiring)
      .where(
        and(
          eq(hookFiring.id, firingId),
          eq(hookFiring.workspaceId, workspaceId),
        ),
      );

    return row ? CausalChain.read(row.cause).followedBy(row.link) : null;
  }

  async forgetFinished(before: Date, most: number): Promise<number> {
    const doomed = this.context.db
      .select({ id: hookFiring.id })
      .from(hookFiring)
      .where(
        and(
          inArray(hookFiring.state, FINISHED),
          lt(hookFiring.handledAt, before),
        ),
      )
      .limit(most);
    const forgotten = await this.context.db
      .delete(hookFiring)
      .where(inArray(hookFiring.id, doomed))
      .returning({ id: hookFiring.id });

    return forgotten.length;
  }
}
