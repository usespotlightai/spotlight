import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { placementMet } from '@platform/persistence/drizzle/placement-met';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import type {
  Claimant,
  RunRepository,
} from '@work/domain/repositories/run.repository';
import { ClaimOrder } from '@work/domain/services/claim-order';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { HandBacks } from '@work/domain/value-objects/hand-backs.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';

type Row = typeof run.$inferSelect;

@Injectable()
export class DrizzleRunRepository implements RunRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Run): Promise<void> {
    await this.context.run(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Run): Promise<void> {
    await this.context.db.insert(run).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      harness: added.harness.value,
      priority: added.priority.value,
      taskId: added.taskId?.value ?? null,
      stationId: added.stationId?.value ?? null,
      chatId: added.chatId?.value ?? null,
      taskRevision: added.subject?.revision?.value ?? null,
      state: added.state,
      spec: RunSpecContract.toWire(added.spec),
      exitCode: added.outcome?.exitCode ?? null,
      message: added.outcome?.message ?? null,
      failure: added.outcome?.failure?.code ?? null,
      stopped: added.outcome?.stopped ?? false,
      placement: added.placement.clauses,
      placementImage: added.placement.image?.value ?? null,
      briefedMemories: added.briefedWith.value,
      ...reservationOf(added),
    });
  }

  async claimNext(by: Claimant, now: Date): Promise<Run | null> {
    if (by.harnesses.length === 0) {
      return null;
    }

    const named = by.harnesses.map((harness) => harness.value);

    return this.context.run(async () => {
      const locked = await this.context.db.execute<{ id: string }>(sql`
        SELECT id
        FROM ${run}
        WHERE ${inArray(run.harness, named)}
          AND state = 'queued'
          AND workspace_id = ${by.workspaceId.value}
          AND ${
            by.claims === 'reserved'
              ? sql`reserved_for = ${by.runner.value} AND reserved_until > ${now.toISOString()}::timestamp`
              : sql`(reserved_for IS NULL OR reserved_for = ${by.runner.value} OR reserved_until <= ${now.toISOString()}::timestamp)`
          }
          AND (claimable_from IS NULL OR claimable_from <= ${now.toISOString()}::timestamp)
          AND ${placementMet(run.placement, run.placementImage, by.terms)}
        ORDER BY priority DESC, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);

      const [row] = locked.rows;
      const found = row ? await this.findById(RunId.of(row.id)) : null;

      if (!found || !ClaimOrder.takeable(found, by, now)) {
        return null;
      }

      const claimed = found.claim(by.runner, now);
      await this.save(claimed);

      return claimed;
    });
  }

  async findById(id: RunId): Promise<Run | null> {
    const [row] = await this.context.db
      .select()
      .from(run)
      .where(eq(run.id, id.value))
      .limit(1);

    return row ? toRun(row) : null;
  }

  async save(saved: Run): Promise<void> {
    await this.context.run(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: Run): Promise<void> {
    const written = await this.context.db
      .update(run)
      .set({
        version: saved.version + 1,
        state: saved.state,
        attempt: saved.attempt,
        claimedBy: saved.claimedBy?.value ?? null,
        leaseExpiresAt: saved.leaseExpiresAt,
        stopRequestedAt: saved.stopRequestedAt,
        exitCode: saved.outcome?.exitCode ?? null,
        message: saved.outcome?.message ?? null,
        failure: saved.outcome?.failure?.code ?? null,
        stopped: saved.outcome?.stopped ?? false,
        ranIn: saved.ranIn?.value ?? null,
        ...reservationOf(saved),
      })
      .where(and(eq(run.id, saved.id.value), eq(run.version, saved.version)))
      .returning({ id: run.id });

    if (written.length === 0) {
      throw new RunMovedOnError(saved.id.value);
    }
  }

  async lapsedClaims(now: Date): Promise<readonly Run[]> {
    const rows = await this.context.db
      .select()
      .from(run)
      .where(and(eq(run.state, 'claimed'), lte(run.leaseExpiresAt, now)));

    return rows.map(toRun);
  }

  async waitingFor(runner: RunnerId): Promise<Run | null> {
    const [found] = await this.context.db
      .select()
      .from(run)
      .where(and(eq(run.state, 'queued'), eq(run.reservedFor, runner.value)))
      .limit(1);

    return found ? toRun(found) : null;
  }

  async awaitingProvision(
    workspaceId: WorkspaceId,
    now: Date,
    page: { readonly skip: number; readonly most: number },
  ): Promise<readonly Run[]> {
    const rows = await this.context.db
      .select()
      .from(run)
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          eq(run.state, 'queued'),
          isNull(run.reservedFor),
          sql`coalesce(jsonb_array_length(${run.spec} -> 'wears'), 0) = 0`,
          or(isNull(run.nextProvisionAt), lte(run.nextProvisionAt, now)),
          or(isNull(run.claimableFrom), lte(run.claimableFrom, now)),
        ),
      )
      .orderBy(desc(run.priority), run.createdAt, run.id)
      .limit(page.most)
      .offset(page.skip);

    return rows.map(toRun);
  }

  async withLapsedReservations(now: Date): Promise<readonly Run[]> {
    const rows = await this.context.db
      .select()
      .from(run)
      .where(and(eq(run.state, 'queued'), lte(run.reservedUntil, now)));

    return rows.map(toRun);
  }

  async claimedBy(runner: RunnerId): Promise<readonly Run[]> {
    const rows = await this.context.db
      .select()
      .from(run)
      .where(and(eq(run.state, 'claimed'), eq(run.claimedBy, runner.value)));

    return rows.map(toRun);
  }
}

const specOf = (row: Row): RunSpec => {
  const spec = RunSpecContract.from(row.spec);

  if (!spec) {
    throw new InconsistentStateError(
      'run',
      `has a spec that no longer reads (${row.id})`,
    );
  }

  return spec;
};

const reservationOf = (held: Run) => ({
  reservedFor: held.reservation?.runner.value ?? null,
  reservedPool: held.reservation?.pool.value ?? null,
  reservedUntil: held.reservation?.until ?? null,
  provisionFailures: held.provisioning.failures,
  nextProvisionAt: held.provisioning.nextAt,
  handBacks: held.handBacks.count,
  claimableFrom: held.handBacks.claimableFrom,
});

const reservationFrom = (row: Row): RunnerReservation | null =>
  row.reservedFor && row.reservedPool && row.reservedUntil
    ? RunnerReservation.of(
        RunnerId.of(row.reservedFor),
        PoolId.of(row.reservedPool),
        row.reservedUntil,
      )
    : null;

const toRun = (row: Row): Run =>
  Run.rehydrate({
    id: RunId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    harness: HarnessId.of(row.harness),
    priority: RunPriority.of(row.priority),
    subject: RunSubject.rehydrate({
      taskId: row.taskId ? TaskId.of(row.taskId) : null,
      stationId: row.stationId ? StationId.of(row.stationId) : null,
      chatId: row.chatId ? ChatId.of(row.chatId) : null,
      revision:
        row.taskRevision === null ? null : TaskRevision.of(row.taskRevision),
    }),
    spec: specOf(row),
    placement: RunnerPlacement.ofClauses(
      row.placement,
      row.placementImage ? RunnerImage.of(row.placementImage) : null,
    ),
    state: row.state,
    claimedBy: row.claimedBy ? RunnerId.of(row.claimedBy) : null,
    leaseExpiresAt: row.leaseExpiresAt,
    stopRequestedAt: row.stopRequestedAt,
    reservation: reservationFrom(row),
    provisioning: Provisioning.rehydrate(
      row.provisionFailures ?? 0,
      row.nextProvisionAt,
    ),
    outcome:
      row.exitCode === null
        ? null
        : RunOutcome.rehydrate({
            exitCode: row.exitCode,
            failure: row.failure ? RunFailure.of(row.failure) : null,
            message: row.message,
            stopped: row.stopped,
          }),
    attempt: row.attempt ?? 1,
    handBacks: HandBacks.rehydrate(row.handBacks ?? 0, row.claimableFrom),
    ranIn: row.ranIn ? RunnerImage.of(row.ranIn) : null,
    briefedWith: row.briefedMemories
      ? BriefedMemories.of(row.briefedMemories)
      : BriefedMemories.none(),
    version: row.version,
  });
