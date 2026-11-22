import { ClaimsRevision } from '@insights/domain/aggregates/claims-revision.aggregate';
import { ClaimsRevisionVersionConflictError } from '@insights/domain/exceptions/claims-revision-version-conflict.error';
import type { ClaimsRevisionRepository } from '@insights/domain/repositories/claims-revision.repository';
import { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { RevisionOutcome } from '@insights/domain/value-objects/revision-outcome.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import { claimsRevision } from '@insights/infrastructure/persistence/drizzle/schemas/judge-repair.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
} from 'drizzle-orm';

type ClaimsRevisionRow = typeof claimsRevision.$inferSelect;

const toRevision = (row: ClaimsRevisionRow): ClaimsRevision =>
  ClaimsRevision.rehydrate({
    id: ClaimsRevisionId.of(row.id),
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: LineId.of(row.lineId),
      stationId: StationId.of(row.stationId),
    },
    rubric: Rubric.of({
      claims: row.claims,
      passThreshold: row.passThreshold,
      version: row.rubricVersion,
    }),
    trigger: row.trigger,
    startedAt: row.startedAt,
    job: row.pending
      ? PendingJob.rehydrate({
          attempts: row.jobAttempts,
          nextAttemptAt: row.jobDueAt,
          waitingSince: row.waitingSince,
        })
      : null,
    judgeCalls: row.judgeCalls,
    reservation:
      row.reservedRound === null
        ? null
        : { attempt: row.reservedRound, judgeCalls: row.reservedJudgeCalls },
    pick:
      row.pickedClaims && row.pickedAgreement
        ? { claims: row.pickedClaims, agreement: row.pickedAgreement }
        : null,
    pickedAt: row.pickedAt,
    outcome: row.outcome
      ? RevisionOutcome.rehydrate({
          kind: row.outcome,
          reason: row.endReason,
          claims: row.proposedClaims,
          pullRequest: row.pullRequest,
          agreement: row.agreement,
          message: row.message,
        })
      : null,
    endedAt: row.endedAt,
    version: row.version,
  });

const columnsOf = (stored: ClaimsRevision) => ({
  pending: stored.job !== null,
  jobAttempts: stored.job?.attempts ?? 0,
  jobDueAt: stored.job?.nextAttemptAt ?? null,
  waitingSince: stored.job?.waitingSince ?? null,
  judgeCalls: stored.judgeCalls,
  reservedRound: stored.reservation?.attempt ?? null,
  reservedJudgeCalls: stored.reservation?.judgeCalls ?? 0,
  pickedClaims: stored.pick ? [...stored.pick.claims] : null,
  pickedAgreement: stored.pick?.agreement ?? null,
  pickedAt: stored.pickedAt,
  outcome: stored.outcome?.kind ?? null,
  endReason: stored.outcome?.reason ?? null,
  proposedClaims: stored.outcome?.claims ? [...stored.outcome.claims] : null,
  pullRequest: stored.outcome?.pullRequest ?? null,
  agreement: stored.outcome?.agreement ?? null,
  message: stored.outcome?.message ?? null,
  endedAt: stored.endedAt,
});

@Injectable()
export class DrizzleClaimsRevisionRepository
  implements ClaimsRevisionRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: ClaimsRevision): Promise<void> {
    await this.context.inTransaction(async () => {
      const { station, rubric } = added;
      const written = await this.context.db
        .insert(claimsRevision)
        .values({
          id: added.id.value,
          workspaceId: station.workspaceId.value,
          teamId: station.teamId.value,
          lineId: station.lineId.value,
          stationId: station.stationId.value,
          claims: [...rubric.claims],
          passThreshold: rubric.passThreshold,
          rubricVersion: rubric.version,
          trigger: added.trigger,
          startedAt: added.startedAt,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing()
        .returning({ id: claimsRevision.id });

      if (written.length === 0) {
        throw new ClaimsRevisionVersionConflictError(added.id.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: ClaimsRevision): Promise<void> {
    await this.context.inTransaction(async () => {
      const matches = and(
        eq(claimsRevision.id, saved.id.value),
        eq(claimsRevision.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(claimsRevision)
            .where(matches)
            .returning({ id: claimsRevision.id })
        : await this.context.db
            .update(claimsRevision)
            .set({ version: saved.version + 1, ...columnsOf(saved) })
            .where(matches)
            .returning({ id: claimsRevision.id });

      if (written.length === 0) {
        throw new ClaimsRevisionVersionConflictError(saved.id.value);
      }

      if (!saved.isDeleted) {
        await this.events.dispatch(saved.pullEvents());
      }
    });
  }

  async find(id: ClaimsRevisionId): Promise<ClaimsRevision | null> {
    const [row] = await this.context.db
      .select()
      .from(claimsRevision)
      .where(eq(claimsRevision.id, id.value))
      .limit(1);

    return row ? toRevision(row) : null;
  }

  async latestAt(stationId: StationId): Promise<ClaimsRevision | null> {
    const [row] = await this.context.db
      .select()
      .from(claimsRevision)
      .where(eq(claimsRevision.stationId, stationId.value))
      .orderBy(desc(claimsRevision.startedAt))
      .limit(1);

    return row ? toRevision(row) : null;
  }

  async nextDueJob(now: Date): Promise<ClaimsRevision | null> {
    const [row] = await this.context.db
      .select()
      .from(claimsRevision)
      .where(
        and(
          eq(claimsRevision.pending, true),
          or(isNull(claimsRevision.jobDueAt), lte(claimsRevision.jobDueAt, now)),
        ),
      )
      .orderBy(asc(claimsRevision.startedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toRevision(row) : null;
  }

  async pickedBefore(
    pickedAt: Date,
    max: number,
  ): Promise<readonly ClaimsRevision[]> {
    const rows = await this.context.db
      .select()
      .from(claimsRevision)
      .where(
        and(
          isNull(claimsRevision.endedAt),
          isNotNull(claimsRevision.pickedAt),
          lt(claimsRevision.pickedAt, pickedAt),
        ),
      )
      .orderBy(asc(claimsRevision.pickedAt))
      .limit(max);

    return rows.map(toRevision);
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly ClaimsRevision[]> {
    const rows = await this.context.db
      .select()
      .from(claimsRevision)
      .where(inScope(claimsRevision, scope))
      .limit(max);

    return rows.map(toRevision);
  }
}
