import {
  HookFiring,
  type HookFiringProgress,
  type HookStepOutcome,
} from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringMovedOnError } from '@integrations/domain/exceptions/hook-firing-moved-on.error';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import {
  HOOK_FAILURES,
  HookFailure,
  type HookFailureCode,
} from '@integrations/domain/value-objects/hook-failure.vo';
import { hookFiring } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { and, asc, eq, inArray, lt, lte, or } from 'drizzle-orm';

type Row = typeof hookFiring.$inferSelect;

const isCode = (code: string): code is HookFailureCode =>
  Object.keys(HOOK_FAILURES).includes(code);

const failureOf = (row: Row): HookFailure | null => {
  if (row.failure === null) {
    return null;
  }

  if (!isCode(row.failure) || row.failed === null) {
    throw new InconsistentStateError(
      'hook firing',
      `failed in a way no hook can (${row.id})`,
    );
  }

  return HookFailure.of(row.failure, row.failed);
};

const progressOf = (row: Row): HookFiringProgress => {
  if (row.state === 'pending') {
    return { kind: 'pending', dueAt: row.dueAt };
  }

  if (row.state === 'working') {
    if (!row.claimedAt) {
      throw new InconsistentStateError(
        'hook firing',
        `is worked on by no one (${row.id})`,
      );
    }

    return { kind: 'working', claimedAt: row.claimedAt };
  }

  if (!row.handledAt) {
    throw new InconsistentStateError(
      'hook firing',
      `finished at no time (${row.id})`,
    );
  }

  return { kind: row.state, at: row.handledAt };
};

const toFiring = (row: Row): HookFiring =>
  HookFiring.rehydrate({
    id: row.id,
    hookId: row.hookId,
    workspaceId: row.workspaceId,
    teamId: row.teamId,
    taskId: row.taskId,
    runId: row.runId,
    stationKey: row.stationKey,
    on: row.on as HookEventName,
    occurrence: row.occurrence,
    firedAt: row.firedAt,
    event: row.event,
    matched: row.matched,
    cause: CausalChain.read(row.cause),
    link: row.link,
    steps: row.steps as unknown as HookStepOutcome[],
    progress: progressOf(row),
    attempts: row.attempts,
    failure: failureOf(row),
    version: row.version,
  });

const progressColumns = (progress: HookFiringProgress) => {
  if (progress.kind === 'pending') {
    return {
      state: progress.kind,
      dueAt: progress.dueAt,
      claimedAt: null,
      handledAt: null,
    };
  }

  if (progress.kind === 'working') {
    return {
      state: progress.kind,
      claimedAt: progress.claimedAt,
      handledAt: null,
    };
  }

  return { state: progress.kind, handledAt: progress.at };
};

const columnsOf = (firing: HookFiring) => ({
  event: { ...firing.event },
  matched: firing.matched,
  steps: firing.steps.map((each) => ({ ...each })),
  attempts: firing.attempts,
  failure: firing.failure?.code ?? null,
  failed: firing.failure?.reason ?? null,
  ...progressColumns(firing.progress),
});

@Injectable()
export class DrizzleHookFirings implements HookFiringRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(firing: HookFiring): Promise<boolean> {
    return this.context.run(async () => {
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
          cause: { ...firing.cause.stored },
          link: { ...firing.link },
          firedAt: firing.firedAt,
          ...columnsOf(firing),
        })
        .onConflictDoNothing()
        .returning({ id: hookFiring.id });

      if (written.length > 0) {
        await this.events.dispatch(firing.pullEvents());
      }

      return written.length > 0;
    });
  }

  async withId(id: string): Promise<HookFiring | null> {
    const [row] = await this.context.db
      .select()
      .from(hookFiring)
      .where(eq(hookFiring.id, id))
      .limit(1);

    return row ? toFiring(row) : null;
  }

  async claimNext(now: Date): Promise<HookFiring | null> {
    return this.context.run(async () => {
      const [row] = await this.context.db
        .select()
        .from(hookFiring)
        .where(
          or(
            and(eq(hookFiring.state, 'pending'), lte(hookFiring.dueAt, now)),
            and(
              eq(hookFiring.state, 'working'),
              lt(hookFiring.claimedAt, HookFiring.leaseLapsedBefore(now)),
            ),
          ),
        )
        .orderBy(asc(hookFiring.dueAt), asc(hookFiring.firedAt))
        .limit(1)
        .for('update', { skipLocked: true });

      if (!row) {
        return null;
      }

      await this.save(toFiring(row).claimed(now));

      return this.withId(row.id);
    });
  }

  async save(firing: HookFiring): Promise<void> {
    await this.context.run(async () => {
      const matching = and(
        eq(hookFiring.id, firing.id),
        eq(hookFiring.version, firing.version),
      );
      const written = firing.isDiscarded
        ? await this.context.db
            .delete(hookFiring)
            .where(matching)
            .returning({ id: hookFiring.id })
        : await this.context.db
            .update(hookFiring)
            .set({ ...columnsOf(firing), version: firing.version + 1 })
            .where(matching)
            .returning({ id: hookFiring.id });

      if (written.length === 0) {
        throw new HookFiringMovedOnError(firing.id);
      }

      await this.events.dispatch(firing.pullEvents());
    });
  }

  async finishedBefore(at: Date, most: number): Promise<readonly HookFiring[]> {
    const rows = await this.context.db
      .select()
      .from(hookFiring)
      .where(
        and(
          inArray(hookFiring.state, ['done', 'failed', 'superseded']),
          lt(hookFiring.handledAt, at),
        ),
      )
      .limit(most);

    return rows.map(toFiring);
  }
}
