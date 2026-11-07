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
import { RunSpecContract } from '@runs/application/contracts/run-spec.contract';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { InvalidRunOrderError } from '@runs/domain/exceptions/invalid-run-order.error';
import { RunAlreadyExistsError } from '@runs/domain/exceptions/run-already-exists.error';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { ClaimOrder } from '@runs/domain/services/claim-order';
import type {
  Claimant,
  SandboxRouting,
} from '@runs/domain/value-objects/claimant';
import { HandedOverFile } from '@runs/domain/value-objects/handed-over-file.vo';
import { Handover } from '@runs/domain/value-objects/handover.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { RequeueCount } from '@runs/domain/value-objects/requeue-count.vo';
import { RunApiGrant } from '@runs/domain/value-objects/run-api-grant.vo';
import { RunExtensions } from '@runs/domain/value-objects/run-extensions.vo';
import { RunFailure } from '@runs/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { RunPolicy } from '@runs/domain/value-objects/run-policy.vo';
import { RunPriority } from '@runs/domain/value-objects/run-priority.vo';
import {
  type RequesterOwner,
  RunRequester,
} from '@runs/domain/value-objects/run-requester.vo';
import {
  LEASED_RUN_STATES,
  type RunState,
  TERMINAL_RUN_STATES,
} from '@runs/domain/value-objects/run-state';
import { RunTags } from '@runs/domain/value-objects/run-tags.vo';
import {
  RunTurn,
  type RunTurnState,
} from '@runs/domain/value-objects/run-turn.vo';
import { StartingPoint } from '@runs/domain/value-objects/starting-point.vo';
import { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import {
  RunWorkspace,
  WorkspaceKey,
} from '@runs/domain/value-objects/workspace-key.vo';
import { placementMatches } from '@runs/infrastructure/persistence/drizzle/placement-matches';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
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
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

const injectsNoSecrets = sql`coalesce(jsonb_array_length(${run.spec} -> 'injectedSecrets'), 0) = 0
  AND coalesce((${run.spec} ->> 'spotlightApi')::boolean, false) = false`;

const noEarlierRunStillLeased = sql`(NOT ${run.exclusive} OR NOT EXISTS (
  SELECT 1 FROM ${run} AS earlier
  WHERE earlier.requester_owner = ${run.requesterOwner}
    AND earlier.requester_kind = ${run.requesterKind}
    AND earlier.requester_id = ${run.requesterId}
    AND earlier.exclusive
    AND earlier.id <> ${run.id}
    AND earlier.state IN (${sql.join(
      LEASED_RUN_STATES.map((each) => sql`${each}`),
      sql`, `,
    )})
))`;

const keyOf = sql`coalesce(${run.workspaceKey}, '')`;

const routedBy = (routing: SandboxRouting | undefined): SQL => {
  if (!routing) {
    return sql`true`;
  }

  if ('into' in routing) {
    return sql`${keyOf} = ${routing.into.value}`;
  }

  return routing.avoiding.length === 0
    ? sql`true`
    : sql`${keyOf} NOT IN (${sql.join(
        routing.avoiding.map((each) => sql`${each.value}`),
        sql`, `,
      )})`;
};

type Row = typeof run.$inferSelect;

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
          ...orderedOf(added),
          orderFingerprint: added.orderFingerprint,
          state: added.state,
          spec: added.spec.value,
          exitCode: added.outcome?.exitCode ?? null,
          message: added.outcome?.message ?? null,
          failure: added.outcome?.failure?.code ?? null,
          stopped: added.outcome?.stopped ?? false,
          placement: added.placement.labelGroups,
          placementImage: added.placement.image?.value ?? null,
          endedAt: endedAtFor(added.state, sql`now()`),
          askedAPerson: added.askedAPerson,
          ...(added.queuedAt ? { queuedAt: added.queuedAt } : {}),
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
          { 'spotlight.run.kind': claimed.requester.kind },
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
    key: WorkspaceKey,
  ): Promise<Run | null> {
    const [row] = await this.selected()
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          eq(run.workspaceKey, key.value),
        ),
      )
      .orderBy(desc(run.createdAt), desc(run.id))
      .limit(1);

    return row ? toRun(row) : null;
  }

  async queuedWithKey(
    workspaceId: WorkspaceId,
    key: WorkspaceKey,
  ): Promise<readonly Run[]> {
    const rows = await this.selected().where(
      and(
        eq(run.workspaceId, workspaceId.value),
        eq(run.state, 'queued'),
        eq(run.workspaceKey, key.value),
      ),
    );

    return rows.map(toRun);
  }

  async findById(id: RunId): Promise<Run | null> {
    const [row] = await this.selected().where(eq(run.id, id.value)).limit(1);

    return row ? toRun(row) : null;
  }

  async findByIds(ids: readonly RunId[]): Promise<readonly Run[]> {
    const wanted = [...new Set(ids.map((each) => each.value))];

    if (wanted.length === 0) {
      return [];
    }

    const rows = await this.selected().where(inArray(run.id, wanted));

    return rows.map(toRun);
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
        spec: saved.spec.value,
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

  async turnsSuspendedBefore(
    owner: RequesterOwner,
    turn: RunTurnState,
    before: Date,
    after: { readonly suspendedAt: Date; readonly id: RunId } | null,
    max: number,
  ): Promise<readonly Run[]> {
    const rows = await this.selected()
      .where(
        and(
          eq(run.turn, turn),
          eq(run.requesterOwner, owner.value),
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
      readonly avoiding: readonly WorkspaceKey[];
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

const orderedOf = (added: Run) => {
  const { requester, policy, workspace } = added;

  return {
    requesterOwner: requester.owner.value,
    requesterKind: requester.kind,
    requesterId: requester.id,
    requesterToken: requester.token,
    teamId: requester.team?.value ?? null,
    ...policy.parts,
    workspaceKey: workspace?.key.value ?? null,
    workspaceRejoinable: workspace?.rejoinable ?? null,
    workspaceRestores: workspace?.restores ?? null,
    restoreArchiveId: added.restore?.value ?? null,
    extensions: added.extensions.value,
    tags: added.tags.value,
    apiGrant: added.apiGrant?.parts ?? null,
  };
};

const storedAs = <T>(id: string, read: () => T): T => {
  try {
    return read();
  } catch (error) {
    if (error instanceof InvalidRunOrderError) {
      throw new InconsistentStateError(
        'run',
        `has an order that no longer reads: ${error.message} (${id})`,
      );
    }

    throw error;
  }
};

const apiGrantFrom = (row: Row): RunApiGrant | null => {
  const grant = row.apiGrant;

  return grant ? storedAs(row.id, () => RunApiGrant.of(grant)) : null;
};

const workspaceFrom = (row: Row): RunWorkspace | null => {
  if (row.workspaceKey === null) {
    return null;
  }

  if (row.workspaceRejoinable === null || row.workspaceRestores === null) {
    throw new InconsistentStateError(
      'run',
      `names a workspace without saying how it is used (${row.id})`,
    );
  }

  return RunWorkspace.of({
    key: WorkspaceKey.parse(row.workspaceKey),
    rejoinable: row.workspaceRejoinable,
    restores: row.workspaceRestores,
  });
};

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
          id: each.id,
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
              HandedOverFile.of(each),
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
    requester: RunRequester.of({
      owner: row.requesterOwner,
      kind: row.requesterKind,
      id: row.requesterId,
      token: row.requesterToken,
      team: row.teamId ? TeamId.of(row.teamId) : null,
    }),
    policy: RunPolicy.of({
      holdsTurn: row.holdsTurn,
      gated: row.gated,
      actsBeyondItself: row.actsBeyondItself,
      asks: row.asks,
      listed: row.listed,
      exclusive: row.exclusive,
    }),
    workspace: workspaceFrom(row),
    restore: row.restoreArchiveId
      ? WorkspaceArchiveId.of(row.restoreArchiveId)
      : null,
    extensions: storedAs(row.id, () => RunExtensions.of(row.extensions)),
    tags: storedAs(row.id, () => RunTags.of(row.tags)),
    apiGrant: apiGrantFrom(row),
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
    orderFingerprint: row.orderFingerprint,
    turn: turnFrom(row),
    endedAt: row.endedAt,
    queuedAt: row.queuedAt,
  });
