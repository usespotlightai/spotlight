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
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import type {
  Claimant,
  KeptWithRun,
  RunRepository,
} from '@work/domain/repositories/run.repository';
import { ClaimOrder } from '@work/domain/services/claim-order';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { HandBacks } from '@work/domain/value-objects/hand-backs.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import {
  HELD_RUN_STATES,
  type RunState,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { StartingPoint } from '@work/domain/value-objects/starting-point.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const noEarlierRunStillHeld = sql`NOT EXISTS (
  SELECT 1 FROM ${run} AS earlier
  WHERE earlier.task_id = ${run.taskId}
    AND earlier.id <> ${run.id}
    AND earlier.state IN (${sql.join(
      HELD_RUN_STATES.map((each) => sql`${each}`),
      sql`, `,
    )})
)`;

type Row = typeof run.$inferSelect;

const replayed = alias(run, 'replayed');

interface Selected {
  readonly run: Row;
  readonly replayedTaskId: string | null;
}

@Injectable()
export class DrizzleRunRepository implements RunRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Run, kept: KeptWithRun = {}): Promise<void> {
    await this.context.run(async () => {
      await this.inserted(added, kept);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Run, kept: KeptWithRun): Promise<void> {
    await this.context.db.insert(run).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      harness: added.harness.value,
      priority: added.priority.value,
      taskId: added.taskId?.value ?? null,
      stationId: added.stationId?.value ?? null,
      chatId: added.chatId?.value ?? null,
      replayOfRunId: added.replayOf?.value ?? null,
      ranForTeamId: added.ranFor?.value ?? null,
      searchId: added.subject?.searchId?.value ?? null,
      searchIteration: added.subject?.iteration?.value ?? null,
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
      endedAt: endedAtFor(added.state, sql`now()`),
      stationFingerprint: added.configuredAs?.fingerprint ?? null,
      stationConfig: added.configuredAs?.parts ?? null,
      briefedTask: kept.briefed?.parts ?? null,
      askedAPerson: added.askedAPerson,
      ...startOf(added),
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
          AND ${noEarlierRunStillHeld}
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

  private selected() {
    return this.context.db
      .select({ run, replayedTaskId: replayed.taskId })
      .from(run)
      .leftJoin(replayed, eq(replayed.id, run.replayOfRunId));
  }

  async findById(id: RunId): Promise<Run | null> {
    const [row] = await this.selected().where(eq(run.id, id.value)).limit(1);

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
        startedAt: saved.startedAt,
        endedAt: endedAtFor(saved.state, sql`coalesce(${run.endedAt}, now())`),
        spec: RunSpecContract.toWire(saved.spec),
        parkedAttempts: [...saved.parkedAttempts],
        askedAPerson: saved.askedAPerson,
        ...(saved.state === 'queued'
          ? {
              queuedAt: sql`case when ${run.state} = 'queued' then ${run.queuedAt} else now() end`,
            }
          : {}),
        ...startOf(saved),
        ...reservationOf(saved),
      })
      .where(and(eq(run.id, saved.id.value), eq(run.version, saved.version)))
      .returning({ id: run.id });

    if (written.length === 0) {
      throw new RunMovedOnError(saved.id.value);
    }
  }

  async lapsedClaims(now: Date): Promise<readonly Run[]> {
    const rows = await this.selected().where(
      and(
        inArray(run.state, [...HELD_RUN_STATES]),
        lte(run.leaseExpiresAt, now),
      ),
    );

    return rows.map(toRun);
  }

  async reservedFor(runner: RunnerId): Promise<Run | null> {
    const [found] = await this.selected()
      .where(and(eq(run.state, 'queued'), eq(run.reservedFor, runner.value)))
      .limit(1);

    return found ? toRun(found) : null;
  }

  async awaitingProvision(
    workspaceId: WorkspaceId,
    now: Date,
    page: { readonly skip: number; readonly most: number },
  ): Promise<readonly Run[]> {
    const rows = await this.selected()
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          eq(run.state, 'queued'),
          isNull(run.reservedFor),
          sql`coalesce(jsonb_array_length(${run.spec} -> 'wears'), 0) = 0`,
          or(isNull(run.nextProvisionAt), lte(run.nextProvisionAt, now)),
          or(isNull(run.claimableFrom), lte(run.claimableFrom, now)),
          noEarlierRunStillHeld,
        ),
      )
      .orderBy(desc(run.priority), run.createdAt, run.id)
      .limit(page.most)
      .offset(page.skip);

    return rows.map(toRun);
  }

  async withLapsedReservations(now: Date): Promise<readonly Run[]> {
    const rows = await this.selected().where(
      and(eq(run.state, 'queued'), lte(run.reservedUntil, now)),
    );

    return rows.map(toRun);
  }

  async claimedBy(runner: RunnerId): Promise<readonly Run[]> {
    const rows = await this.selected().where(
      and(eq(run.state, 'claimed'), eq(run.claimedBy, runner.value)),
    );

    return rows.map(toRun);
  }
}

const startOf = (held: Run) => ({
  startedFromArchiveId: held.startedFrom?.archive?.value ?? null,
  startedFromCheckouts: held.startedFrom?.parts.checkouts ?? null,
  startedFromAttempt: held.startedFrom?.attempt ?? null,
  startedFromAt: held.startedFrom?.at ?? null,
});

const configuredFrom = (row: Row): StationConfig | null => {
  if (row.stationConfig === null && row.stationFingerprint === null) {
    return null;
  }

  if (row.stationConfig === null || row.stationFingerprint === null) {
    throw new InconsistentStateError(
      'run',
      `keeps only half of its station config (${row.id})`,
    );
  }

  return StationConfig.rehydrate(row.stationConfig, row.stationFingerprint);
};

const startFrom = (row: Row): StartingPoint | null => {
  const { startedFromAttempt, startedFromAt, startedFromCheckouts } = row;

  if (
    startedFromAttempt === null &&
    startedFromAt === null &&
    startedFromCheckouts === null &&
    row.startedFromArchiveId === null
  ) {
    return null;
  }

  if (
    startedFromAttempt === null ||
    startedFromAt === null ||
    startedFromCheckouts === null
  ) {
    throw new InconsistentStateError(
      'run',
      `records only part of where it started (${row.id})`,
    );
  }

  return StartingPoint.rehydrate({
    archive: row.startedFromArchiveId,
    checkouts: startedFromCheckouts,
    attempt: startedFromAttempt,
    at: startedFromAt,
  });
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

const endedAtFor = (state: RunState, ended: SQL) =>
  (TERMINAL_RUN_STATES as readonly RunState[]).includes(state) ? ended : null;

const toRun = ({ run: row, replayedTaskId }: Selected): Run =>
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
      replayOf: row.replayOfRunId ? RunId.of(row.replayOfRunId) : null,
      replayedTaskId: replayedTaskId ? TaskId.of(replayedTaskId) : null,
      ranFor: row.ranForTeamId ? TeamId.of(row.ranForTeamId) : null,
      searchId: row.searchId ? SearchId.of(row.searchId) : null,
      iteration:
        row.searchIteration === null
          ? null
          : SearchIteration.of(row.searchIteration),
    }),
    spec: RunSpecContract.from(row.spec),
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
      row.provisionFailures,
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
    attempt: row.attempt,
    handBacks: HandBacks.rehydrate(row.handBacks, row.claimableFrom),
    ranIn: row.ranIn ? RunnerImage.of(row.ranIn) : null,
    briefedWith: row.briefedMemories
      ? BriefedMemories.of(row.briefedMemories)
      : BriefedMemories.none(),
    parkedAttempts: row.parkedAttempts,
    configuredAs: configuredFrom(row),
    startedAt: row.startedAt,
    startedFrom: startFrom(row),
    askedAPerson: row.askedAPerson,
    version: row.version,
  });
