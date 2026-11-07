import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  activeTraceparent,
  linkActiveSpanTo,
} from '@platform/telemetry/trace-context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunAlreadyExistsError } from '@work/domain/exceptions/run-already-exists.error';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ClaimOrder } from '@work/domain/services/claim-order';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type {
  Claimant,
  SandboxRouting,
} from '@work/domain/value-objects/claimant';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { RequeueCount } from '@work/domain/value-objects/requeue-count.vo';
import type { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import {
  LEASED_RUN_STATES,
  type RunState,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import {
  RunTurn,
  type RunTurnState,
} from '@work/domain/value-objects/run-turn.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { StartingPoint } from '@work/domain/value-objects/starting-point.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { placementMatches } from '@work/infrastructure/persistence/drizzle/placement-matches';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

const injectsNoSecrets = sql`coalesce(jsonb_array_length(${run.spec} -> 'injectedSecrets'), 0) = 0
  AND coalesce((${run.spec} ->> 'spotlightApi')::boolean, false) = false`;

const noEarlierRunStillLeased = sql`NOT EXISTS (
  SELECT 1 FROM ${run} AS earlier
  WHERE (earlier.task_id = ${run.taskId} OR earlier.chat_id = ${run.chatId})
    AND earlier.id <> ${run.id}
    AND earlier.state IN (${sql.join(
      LEASED_RUN_STATES.map((each) => sql`${each}`),
      sql`, `,
    )})
)`;

const resumeKeyOf = sql`coalesce(${run.spec} -> 'resume' ->> 'key', '')`;

const routedBy = (routing: SandboxRouting | undefined): SQL => {
  if (!routing) {
    return sql`true`;
  }

  if ('into' in routing) {
    return sql`${resumeKeyOf} = ${routing.into.value}`;
  }

  return routing.avoiding.length === 0
    ? sql`true`
    : sql`${resumeKeyOf} NOT IN (${sql.join(
        routing.avoiding.map((each) => sql`${each.value}`),
        sql`, `,
      )})`;
};

type Row = typeof run.$inferSelect;

const kindOf = (claimed: Run): string => {
  if (claimed.replayOf) {
    return 'replay';
  }
  if (claimed.subject?.searchId) {
    return 'search';
  }
  if (claimed.chatId) {
    return 'chat';
  }
  return claimed.taskId ? 'task' : 'other';
};

interface Selected {
  readonly run: Row;
}

@Injectable()
export class DrizzleRunRepository implements RunRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
    @Inject(TELEMETRY) private readonly telemetry: TelemetryPort,
  ) {}

  async add(added: Run): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Run): Promise<void> {
    await this.context
      .inSavepoint(() =>
        this.context.db.insert(run).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          harness: added.harness.value,
          priority: added.priority.value,
          taskId: added.taskId?.value ?? null,
          stationId: added.stationId?.value ?? null,
          chatId: added.chatId?.value ?? null,
          replayOfRunId: added.replayOf?.value ?? null,
          replayedTaskId: added.subject?.replayedTaskId?.value ?? null,
          ranForTeamId: added.ranFor?.value ?? null,
          teamId: added.team?.value ?? null,
          orderFingerprint: added.orderFingerprint,
          searchId: added.subject?.searchId?.value ?? null,
          searchIteration: added.subject?.iteration?.value ?? null,
          taskRevision: added.subject?.revision?.value ?? null,
          state: added.state,
          spec: RunSpecContract.toWire(added.spec),
          exitCode: added.outcome?.exitCode ?? null,
          message: added.outcome?.message ?? null,
          failure: added.outcome?.failure?.code ?? null,
          stopped: added.outcome?.stopped ?? false,
          placement: added.placement.labelGroups,
          placementImage: added.placement.image?.value ?? null,
          endedAt: endedAtFor(added.state, sql`now()`),
          askedAPerson: added.askedAPerson,
          traceparent: activeTraceparent(),
          ...startOf(added),
          ...reservationOf(added),
        }),
      )
      .catch((error: unknown) => {
        if (violates(error, UNIQUE_VIOLATION, 'run_pkey')) {
          throw new RunAlreadyExistsError(added.id.value);
        }
        throw error;
      });
  }

  async claimNext(by: Claimant, now: Date): Promise<Run | null> {
    if (by.harnesses.length === 0) {
      return null;
    }

    const named = by.harnesses.map((harness) => harness.value);

    return this.context.inTransaction(async () => {
      const locked = await this.context.db.execute<{
        id: string;
        traceparent: string | null;
        waited: string | number | null;
      }>(sql`
        SELECT id, traceparent,
          extract(epoch from (${now.toISOString()}::timestamptz - queued_at)) AS waited
        FROM ${run}
        WHERE ${inArray(run.harness, named)}
          AND state = 'queued'
          AND workspace_id = ${by.workspaceId.value}
          AND ${
            by.claims === 'reserved'
              ? sql`reserved_for = ${by.runner.value} AND reserved_until > ${now.toISOString()}::timestamptz`
              : sql`(reserved_for IS NULL OR reserved_for = ${by.runner.value} OR reserved_until <= ${now.toISOString()}::timestamptz)`
          }
          AND (claimable_from IS NULL OR claimable_from <= ${now.toISOString()}::timestamptz)
          AND ${placementMatches(run.placement, run.placementImage, by.offer)}
          AND ${noEarlierRunStillLeased}
          AND ${routedBy(by.sandbox)}
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
      this.context.afterCommit(() => {
        linkActiveSpanTo(row?.traceparent ?? null);
        this.telemetry.measure(
          'spotlight.runs.claim_wait_seconds',
          Math.max(0, Number(row?.waited ?? 0)),
          { 'spotlight.run.kind': kindOf(claimed) },
        );
      });

      return claimed;
    });
  }

  private selected() {
    return this.context.db.select({ run }).from(run);
  }

  async newestWithKey(
    workspaceId: WorkspaceId,
    key: ResumeKey,
  ): Promise<Run | null> {
    const [row] = await this.selected()
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          sql`${resumeKeyOf} = ${key.value}`,
        ),
      )
      .orderBy(desc(run.createdAt), desc(run.id))
      .limit(1);

    return row ? toRun(row) : null;
  }

  async queuedWithKey(
    workspaceId: WorkspaceId,
    key: ResumeKey,
  ): Promise<readonly Run[]> {
    const rows = await this.selected().where(
      and(
        eq(run.workspaceId, workspaceId.value),
        eq(run.state, 'queued'),
        sql`${resumeKeyOf} = ${key.value}`,
      ),
    );

    return rows.map(toRun);
  }

  async findById(id: RunId): Promise<Run | null> {
    const [row] = await this.selected().where(eq(run.id, id.value)).limit(1);

    return row ? toRun(row) : null;
  }

  async save(saved: Run): Promise<void> {
    await this.context.inTransaction(async () => {
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
        endedAt: endedAtFor(
          saved.state,
          saved.endedAt ?? sql`coalesce(${run.endedAt}, now())`,
        ),
        spec: RunSpecContract.toWire(saved.spec),
        suspendedAttempts: [...saved.suspendedAttempts],
        askedAPerson: saved.askedAPerson,
        ...turnOf(saved),
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
      throw new RunVersionConflictError(saved.id.value);
    }
  }

  async expiredLeases(now: Date): Promise<readonly Run[]> {
    const rows = await this.selected().where(
      and(
        inArray(run.state, [...LEASED_RUN_STATES]),
        lte(run.leaseExpiresAt, now),
      ),
    );

    return rows.map(toRun);
  }

  async turnsOfTasksSuspendedBefore(
    turn: RunTurnState,
    before: Date,
    after: { readonly suspendedAt: Date; readonly id: RunId } | null,
    max: number,
  ): Promise<readonly Run[]> {
    const rows = await this.selected()
      .where(
        and(
          eq(run.turn, turn),
          isNotNull(run.taskId),
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

  async reservedFor(runner: RunnerId): Promise<Run | null> {
    const [found] = await this.selected()
      .where(and(eq(run.state, 'queued'), eq(run.reservedFor, runner.value)))
      .limit(1);

    return found ? toRun(found) : null;
  }

  async awaitingProvision(
    workspaceId: WorkspaceId,
    now: Date,
    page: {
      readonly skip: number;
      readonly max: number;
      readonly withSecrets: boolean;
      readonly avoiding: readonly ResumeKey[];
    },
  ): Promise<readonly Run[]> {
    const rows = await this.selected()
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          eq(run.state, 'queued'),
          isNull(run.reservedFor),
          page.withSecrets ? undefined : injectsNoSecrets,
          or(
            isNull(run.nextProvisionAttemptAt),
            lte(run.nextProvisionAttemptAt, now),
          ),
          or(isNull(run.claimableFrom), lte(run.claimableFrom, now)),
          noEarlierRunStillLeased,
          routedBy({ avoiding: page.avoiding }),
        ),
      )
      .orderBy(desc(run.priority), run.createdAt, run.id)
      .limit(page.max)
      .offset(page.skip);

    return rows.map(toRun);
  }

  async withExpiredReservations(now: Date): Promise<readonly Run[]> {
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

const startOf = (saving: Run) => ({
  startedFromArchiveId: saving.startedFrom?.archive?.value ?? null,
  startedFromCheckouts: saving.startedFrom?.parts.checkouts ?? null,
  startedFromAttempt: saving.startedFrom?.attempt ?? null,
  startedFromAt: saving.startedFrom?.at ?? null,
});

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

const reservationOf = (saving: Run) => ({
  reservedFor: saving.reservation?.runner.value ?? null,
  reservedPool: saving.reservation?.pool.value ?? null,
  reservedUntil: saving.reservation?.until ?? null,
  provisionAttempts: saving.provisioning.attempts,
  nextProvisionAttemptAt: saving.provisioning.nextAttemptAt,
  requeueCount: saving.requeueCount.count,
  claimableFrom: saving.requeueCount.claimableFrom,
});

const reservationFrom = (row: Row): RunnerReservation | null =>
  row.reservedFor && row.reservedPool && row.reservedUntil
    ? RunnerReservation.of(
        RunnerId.of(row.reservedFor),
        PoolId.of(row.reservedPool),
        row.reservedUntil,
      )
    : null;

const turnOf = (saved: Run) => {
  const turn = saved.turn;

  if (!turn) {
    return { turn: null, turnReport: null, suspendedAt: null };
  }

  const { handover, session } = turn.report;

  return {
    turn: turn.state,
    suspendedAt: turn.suspendedAt,
    turnReport: {
      handover: handover && {
        next: handover.next,
        note: handover.note,
        attachments: handover.attachments.map((each) => ({
          id: each.id.value,
          name: each.name,
          contentType: each.contentType,
          size: each.size,
        })),
      },
      session: session?.value ?? null,
      reportedBy: turn.reportedBy.value,
    },
  };
};

const turnFrom = (row: Row): RunTurn | null => {
  if (row.turn === null) {
    return null;
  }

  if (row.turnReport === null || row.suspendedAt === null) {
    throw new InconsistentStateError(
      'run',
      `holds a turn without its report (${row.id})`,
    );
  }

  const { handover, session, reportedBy } = row.turnReport;

  return RunTurn.rehydrate({
    state: row.turn,
    report: HandoverReport.of({
      handover: handover
        ? Handover.of({
            next: handover.next,
            note: handover.note,
            attachments: handover.attachments.map((each) =>
              Attachment.rehydrate(each),
            ),
          })
        : null,
      session: session ? HarnessSession.of(session) : null,
    }),
    reportedBy: RunnerId.of(reportedBy),
    suspendedAt: row.suspendedAt,
  });
};

const endedAtFor = (state: RunState, ended: SQL | Date) =>
  (TERMINAL_RUN_STATES as readonly RunState[]).includes(state) ? ended : null;

const toRun = ({ run: row }: Selected): Run =>
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
      replayedTaskId: row.replayedTaskId ? TaskId.of(row.replayedTaskId) : null,
      ranFor: row.ranForTeamId ? TeamId.of(row.ranForTeamId) : null,
      searchId: row.searchId ? SearchId.of(row.searchId) : null,
      iteration:
        row.searchIteration === null
          ? null
          : SearchIteration.of(row.searchIteration),
    }),
    spec: RunSpecContract.from(row.spec),
    placement: RunnerPlacement.ofLabelGroups(
      row.placement,
      row.placementImage ? RunnerImage.of(row.placementImage) : null,
    ),
    state: row.state,
    claimedBy: row.claimedBy ? RunnerId.of(row.claimedBy) : null,
    leaseExpiresAt: row.leaseExpiresAt,
    stopRequestedAt: row.stopRequestedAt,
    reservation: reservationFrom(row),
    provisioning: Provisioning.rehydrate(
      row.provisionAttempts,
      row.nextProvisionAttemptAt,
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
    requeueCount: RequeueCount.rehydrate(row.requeueCount, row.claimableFrom),
    ranIn: row.ranIn ? RunnerImage.of(row.ranIn) : null,
    suspendedAttempts: row.suspendedAttempts,
    startedAt: row.startedAt,
    startedFrom: startFrom(row),
    askedAPerson: row.askedAPerson,
    version: row.version,
    team: row.teamId ? TeamId.of(row.teamId) : null,
    orderFingerprint: row.orderFingerprint,
    turn: turnFrom(row),
    endedAt: row.endedAt,
  });
