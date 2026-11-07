import {
  HOOK_FIRING_SKIPS,
  HookFiring,
  type HookFiringProgress,
} from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import { CausalChain } from '@integrations/domain/value-objects/causal-chain.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import {
  HookEvent,
  type HookEventName,
} from '@integrations/domain/value-objects/hook-event.vo';
import {
  HOOK_FAILURES,
  HookFailure,
  type HookFailureCode,
} from '@integrations/domain/value-objects/hook-failure.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import type { HookStepOutcome } from '@integrations/domain/value-objects/hook-step-outcome.vo';
import { RunAttemptRef } from '@integrations/domain/value-objects/run-attempt-ref.vo';
import {
  eventOfRecord,
  recordOfEvent,
} from '@integrations/infrastructure/hooks/hook-event-record';
import { hookFiring } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, inArray, lt, lte, or } from 'drizzle-orm';

type Row = typeof hookFiring.$inferSelect;

const eventNameOf = (row: Row): HookEventName => {
  try {
    return HookEvent.of(row.on).name;
  } catch {
    throw new InconsistentStateError(
      'hook firing',
      `fired on an unknown event (${row.id})`,
    );
  }
};

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

  if (row.state === 'skipped') {
    const because = HOOK_FIRING_SKIPS.find((skip) => skip === row.skipped);

    if (!because) {
      throw new InconsistentStateError(
        'hook firing',
        `was skipped for no known reason (${row.id})`,
      );
    }

    return { kind: 'skipped', at: row.handledAt, because };
  }

  return { kind: row.state, at: row.handledAt };
};

type StoredStep = Readonly<Record<string, unknown>>;

const unreadableStep = (id: string, why: string): InconsistentStateError =>
  new InconsistentStateError('hook firing', `stores a step ${why} (${id})`);

const stepOf =
  (id: string) =>
  (stored: StoredStep): HookStepOutcome => {
    const { status } = stored;

    if (typeof stored.name !== 'string' || stored.name.length === 0) {
      throw unreadableStep(id, 'without a name');
    }

    const name = HookStepName.rehydrate(stored.name);

    if (status === 'done') {
      return { name, status, output: stored.output ?? null };
    }

    if (status === 'failed') {
      const { code, reason } = stored;

      if (typeof code !== 'string' || !isCode(code)) {
        throw unreadableStep(
          id,
          `${name.value} that failed in a way no hook can`,
        );
      }

      if (typeof reason !== 'string') {
        throw unreadableStep(id, `${name.value} that failed for no reason`);
      }

      return { name, status, code, reason, output: stored.output ?? null };
    }

    if (status === 'waiting') {
      const until = new Date(String(stored.until));

      if (typeof stored.call !== 'string' || Number.isNaN(until.getTime())) {
        throw unreadableStep(id, `${name.value} that waits on nothing`);
      }

      return { name, status, call: stored.call, until };
    }

    throw unreadableStep(id, `${name.value} in no known status`);
  };

const storedStep = (step: HookStepOutcome): StoredStep =>
  step.status === 'waiting'
    ? { ...step, name: step.name.value, until: step.until.toISOString() }
    : { ...step, name: step.name.value };

const toFiring = (row: Row): HookFiring =>
  HookFiring.rehydrate({
    id: HookFiringId.of(row.id),
    hookId: HookDefinitionId.of(row.hookId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    taskId: TaskId.of(row.taskId),
    run:
      row.runId === null || row.runAttempt === null
        ? null
        : RunAttemptRef.of(RunId.of(row.runId), row.runAttempt),
    stationKey: StationKey.of(row.stationKey),
    on: eventNameOf(row),
    occurrence: HookOccurrenceKey.rehydrate(row.occurrence),
    firedAt: row.firedAt,
    event: eventOfRecord(eventNameOf(row), row.event),
    matched: row.matched,
    cause: CausalChain.read(row.cause),
    link: CausalChain.readLink(row.link),
    steps: row.steps.map(stepOf(row.id)),
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

  return {
    state: progress.kind,
    handledAt: progress.at,
    skipped: progress.kind === 'skipped' ? progress.because : null,
  };
};

const columnsOf = (firing: HookFiring) => ({
  event: { ...recordOfEvent(firing.event) },
  matched: firing.matched,
  steps: firing.steps.map(storedStep),
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
    const { progress } = firing;

    if (progress.kind !== 'pending') {
      throw new InconsistentStateError(
        'hook firing',
        `is added while ${progress.kind} (${firing.id.value})`,
      );
    }

    return this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(hookFiring)
        .values({
          id: firing.id.value,
          hookId: firing.hookId.value,
          workspaceId: firing.workspaceId.value,
          teamId: firing.teamId.value,
          taskId: firing.taskId.value,
          runId: firing.run?.runId.value ?? null,
          runAttempt: firing.run?.attempt ?? null,
          stationKey: firing.stationKey.value,
          on: firing.on,
          occurrence: firing.occurrence.value,
          cause: { ...firing.cause.stored },
          link: { ...firing.link },
          firedAt: firing.firedAt,
          ...columnsOf(firing),
          dueAt: progress.dueAt,
        })
        .onConflictDoNothing()
        .returning({ id: hookFiring.id });

      if (written.length > 0) {
        await this.events.dispatch(firing.pullEvents());
      }

      return written.length > 0;
    });
  }

  async withId(id: HookFiringId): Promise<HookFiring | null> {
    const [row] = await this.context.db
      .select()
      .from(hookFiring)
      .where(eq(hookFiring.id, id.value))
      .limit(1);

    return row ? toFiring(row) : null;
  }

  async claimCandidates(
    now: Date,
    max: number,
  ): Promise<readonly HookFiring[]> {
    const rows = await this.context.db
      .select()
      .from(hookFiring)
      .where(
        and(
          lte(hookFiring.dueAt, now),
          or(
            eq(hookFiring.state, 'pending'),
            and(
              eq(hookFiring.state, 'working'),
              lt(hookFiring.claimedAt, HookFiring.leaseExpiredBefore(now)),
            ),
          ),
        ),
      )
      .orderBy(asc(hookFiring.dueAt), asc(hookFiring.firedAt))
      .limit(max);

    return rows.map(toFiring);
  }

  async save(firing: HookFiring): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(hookFiring.id, firing.id.value),
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
        throw new HookFiringVersionConflictError(firing.id.value);
      }

      await this.events.dispatch(firing.pullEvents());
    });
  }

  async finishedBefore(at: Date, max: number): Promise<readonly HookFiring[]> {
    const rows = await this.context.db
      .select()
      .from(hookFiring)
      .where(
        and(
          inArray(hookFiring.state, [
            'done',
            'failed',
            'superseded',
            'skipped',
          ]),
          lt(hookFiring.handledAt, at),
        ),
      )
      .limit(max);

    return rows.map(toFiring);
  }
}
