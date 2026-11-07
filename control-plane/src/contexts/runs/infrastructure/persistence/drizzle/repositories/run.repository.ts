import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { activeTraceparent } from '@platform/telemetry/trace-context';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { InvalidRunOrderError } from '@runs/domain/exceptions/invalid-run-order.error';
import { RunAlreadyExistsError } from '@runs/domain/exceptions/run-already-exists.error';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type {
  ClaimCursor,
  QueuedRuns,
} from '@runs/domain/services/claim-order';
import type {
  Claimant,
  SandboxRouting,
} from '@runs/domain/value-objects/claimant';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
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
import { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import { LEASED_RUN_STATES } from '@runs/domain/value-objects/run-state';
import { RunTags } from '@runs/domain/value-objects/run-tags.vo';
import { RunTurn } from '@runs/domain/value-objects/run-turn.vo';
import { StartingPoint } from '@runs/domain/value-objects/starting-point.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import {
  RunWorkingCopy,
  WorkingCopyKey,
} from '@runs/domain/value-objects/working-copy-key.vo';
import { placementMatches } from '@runs/infrastructure/persistence/drizzle/placement-matches';
import { RunSpecPersistence } from '@runs/infrastructure/persistence/drizzle/run-spec.persistence';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
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

const keyOf = sql`coalesce(${run.workingCopyKey}, '')`;

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
          spec: RunSpecPersistence.toRow(added.spec),
          injectsSecrets: added.injectsSecrets,
          exitCode: added.outcome?.exitCode.value ?? null,
          detail: added.outcome?.detail ?? null,
          failureAttempts: added.outcome?.attempts ?? null,
          failure: added.outcome?.failure?.code ?? null,
          stopped: added.outcome?.stopped ?? false,
          placement: added.placement.labelGroups,
          placementImage: added.placement.image?.value ?? null,
          endedAt: added.endedAt,
          askedAPerson: added.askedAPerson,
          queuedAt: added.queuedAt,
          createdAt: added.createdAt,
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

  async claimCandidates(
    by: Claimant,
    now: Date,
    page: { readonly max: number; readonly after: ClaimCursor | null },
  ): Promise<QueuedRuns> {
    if (by.harnesses.length === 0) {
      return { waiting: [], leasedRequesters: [] };
    }

    const rows = await this.selected()
      .where(
        and(
          inArray(
            run.harness,
            by.harnesses.map((harness) => harness.value),
          ),
          eq(run.state, 'queued'),
          eq(run.workspaceId, by.workspaceId.value),
          by.claims === 'reserved'
            ? and(
                eq(run.reservedFor, by.runner.value),
                gt(run.reservedUntil, now),
              )
            : or(
                isNull(run.reservedFor),
                eq(run.reservedFor, by.runner.value),
                lte(run.reservedUntil, now),
              ),
          or(isNull(run.claimableFrom), lte(run.claimableFrom, now)),
          placementMatches(run.placement, run.placementImage, by.offer),
          routedBy(by.sandbox),
          page.after ? claimedAfter(page.after) : undefined,
        ),
      )
      .orderBy(desc(run.priority), asc(run.createdAt), asc(run.id))
      .limit(page.max);

    return this.queuedRunsOf(rows.map(toRun));
  }

  private async queuedRunsOf(waiting: readonly Run[]): Promise<QueuedRuns> {
    return {
      waiting,
      leasedRequesters: await this.leasedAmong(
        waiting
          .filter((each) => each.policy.exclusive)
          .map((each) => each.requester),
      ),
    };
  }

  async leasedAmong(
    requesters: readonly RunRequester[],
  ): Promise<readonly RunRequester[]> {
    if (requesters.length === 0) {
      return [];
    }

    const leased = await this.context.db
      .selectDistinct({
        requesterOwner: run.requesterOwner,
        requesterKind: run.requesterKind,
        requesterId: run.requesterId,
      })
      .from(run)
      .where(
        and(
          eq(run.exclusive, true),
          inArray(run.state, [...LEASED_RUN_STATES]),
          inArray(run.requesterId, [
            ...new Set(requesters.map((each) => each.id)),
          ]),
        ),
      );

    return leased.map((row) =>
      RunRequester.of({
        owner: row.requesterOwner,
        kind: row.requesterKind,
        id: row.requesterId,
        token: null,
        team: null,
      }),
    );
  }

  private selected() {
    return this.context.db.select({ run }).from(run);
  }

  async newestWithKey(
    workspaceId: WorkspaceId,
    key: WorkingCopyKey,
  ): Promise<Run | null> {
    const [row] = await this.selected()
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          eq(run.workingCopyKey, key.value),
        ),
      )
      .orderBy(desc(run.createdAt), desc(run.id))
      .limit(1);

    return row ? toRun(row) : null;
  }

  async queuedWithKey(
    workspaceId: WorkspaceId,
    key: WorkingCopyKey,
  ): Promise<readonly Run[]> {
    const rows = await this.selected().where(
      and(
        eq(run.workspaceId, workspaceId.value),
        eq(run.state, 'queued'),
        eq(run.workingCopyKey, key.value),
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
        attempt: saved.attempt.number,
        claimedBy: saved.claimedBy?.value ?? null,
        leaseExpiresAt: saved.leaseExpiresAt,
        stopRequestedAt: saved.stopRequestedAt,
        exitCode: saved.outcome?.exitCode.value ?? null,
        detail: saved.outcome?.detail ?? null,
        failureAttempts: saved.outcome?.attempts ?? null,
        failure: saved.outcome?.failure?.code ?? null,
        stopped: saved.outcome?.stopped ?? false,
        ranIn: saved.ranIn?.value ?? null,
        startedAt: saved.startedAt,
        endedAt: saved.endedAt,
        spec: RunSpecPersistence.toRow(saved.spec),
        injectsSecrets: saved.injectsSecrets,
        suspendedAttempts: saved.suspendedAttempts.map((each) => each.number),
        askedAPerson: saved.askedAPerson,
        ...turnOf(saved),
        queuedAt: saved.queuedAt,
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
      readonly avoiding: readonly WorkingCopyKey[];
    },
  ): Promise<QueuedRuns> {
    const rows = await this.selected()
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          eq(run.state, 'queued'),
          isNull(run.reservedFor),
          page.withSecrets ? undefined : eq(run.injectsSecrets, false),
          or(
            isNull(run.nextProvisionAttemptAt),
            lte(run.nextProvisionAttemptAt, now),
          ),
          or(isNull(run.claimableFrom), lte(run.claimableFrom, now)),
          routedBy({ avoiding: page.avoiding }),
        ),
      )
      .orderBy(desc(run.priority), asc(run.createdAt), asc(run.id))
      .limit(page.max)
      .offset(page.skip);

    return this.queuedRunsOf(rows.map(toRun));
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
  const { requester, policy, workingCopy } = added;

  return {
    requesterOwner: requester.owner.value,
    requesterKind: requester.kind,
    requesterId: requester.id,
    requesterToken: requester.token,
    teamId: requester.team?.value ?? null,
    ...policy.parts,
    workingCopyKey: workingCopy?.key.value ?? null,
    workingCopyRejoinable: workingCopy?.rejoinable ?? null,
    workingCopyRestores: workingCopy?.restores ?? null,
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

const workingCopyFrom = (row: Row): RunWorkingCopy | null => {
  if (row.workingCopyKey === null) {
    return null;
  }

  if (row.workingCopyRejoinable === null || row.workingCopyRestores === null) {
    throw new InconsistentStateError(
      'run',
      `names a working copy without saying how it is used (${row.id})`,
    );
  }

  return RunWorkingCopy.of({
    key: WorkingCopyKey.parse(row.workingCopyKey),
    rejoinable: row.workingCopyRejoinable,
    restores: row.workingCopyRestores,
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

const claimedAfter = (after: ClaimCursor) =>
  or(
    lt(run.priority, after.priority),
    and(
      eq(run.priority, after.priority),
      or(
        gt(run.createdAt, after.createdAt),
        and(eq(run.createdAt, after.createdAt), gt(run.id, after.id)),
      ),
    ),
  );

export const toRun = ({ run: row }: Selected): Run =>
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
    workingCopy: workingCopyFrom(row),
    restore: row.restoreArchiveId
      ? WorkingCopyArchiveId.of(row.restoreArchiveId)
      : null,
    extensions: storedAs(row.id, () => RunExtensions.of(row.extensions)),
    tags: storedAs(row.id, () => RunTags.of(row.tags)),
    apiGrant: apiGrantFrom(row),
    spec: RunSpecPersistence.fromRow(row.spec),
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
            exitCode: ExitCode.of(row.exitCode),
            failure: row.failure ? RunFailure.of(row.failure) : null,
            detail: row.detail,
            attempts: row.failureAttempts,
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
    createdAt: row.createdAt,
  });
