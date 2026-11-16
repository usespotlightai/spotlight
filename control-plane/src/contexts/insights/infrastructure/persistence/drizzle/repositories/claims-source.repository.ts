import { ClaimsSource } from '@insights/domain/aggregates/claims-source.aggregate';
import { ClaimsSourceVersionConflictError } from '@insights/domain/exceptions/claims-source-version-conflict.error';
import type { ClaimsSourceRepository } from '@insights/domain/repositories/claims-source.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import { claimsSource } from '@insights/infrastructure/persistence/drizzle/schemas/judge-repair.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';

type ClaimsSourceRow = typeof claimsSource.$inferSelect;

const toSource = (row: ClaimsSourceRow): ClaimsSource =>
  ClaimsSource.rehydrate({
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: LineId.of(row.lineId),
      stationId: StationId.of(row.stationId),
    },
    rubricVersion: RubricVersion.of(row.rubricVersion),
    commit: SourceCommit.of({ repository: row.repository, sha: row.sha }),
    recordedAt: row.recordedAt,
    pullRequest:
      row.pullRequestNumber !== null &&
      row.pullRequestUrl !== null &&
      row.pullRequestTitle !== null
        ? {
            number: row.pullRequestNumber,
            url: row.pullRequestUrl,
            title: row.pullRequestTitle,
          }
        : null,
    resolvedAt: row.resolvedAt,
    job: row.pending
      ? PendingJob.rehydrate({
          attempts: row.jobAttempts,
          nextAttemptAt: row.jobDueAt,
        })
      : null,
    lookups: row.lookups,
    version: row.version,
  });

const columnsOf = (stored: ClaimsSource) => ({
  pullRequestNumber: stored.pullRequest?.number ?? null,
  pullRequestUrl: stored.pullRequest?.url ?? null,
  pullRequestTitle: stored.pullRequest?.title ?? null,
  resolvedAt: stored.resolvedAt,
  pending: stored.job !== null,
  jobAttempts: stored.job?.attempts ?? 0,
  jobDueAt: stored.job?.nextAttemptAt ?? null,
  lookups: stored.lookups,
});

const at = (stored: ClaimsSource) =>
  and(
    eq(claimsSource.stationId, stored.station.stationId.value),
    eq(claimsSource.rubricVersion, stored.rubricVersion),
    eq(claimsSource.version, stored.version),
  );

@Injectable()
export class DrizzleClaimsSourceRepository implements ClaimsSourceRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(
    stationId: StationId,
    rubricVersion: RubricVersion,
  ): Promise<ClaimsSource | null> {
    const [row] = await this.context.db
      .select()
      .from(claimsSource)
      .where(
        and(
          eq(claimsSource.stationId, stationId.value),
          eq(claimsSource.rubricVersion, rubricVersion),
        ),
      )
      .limit(1);

    return row ? toSource(row) : null;
  }

  async nextDueJob(now: Date): Promise<ClaimsSource | null> {
    const [row] = await this.context.db
      .select()
      .from(claimsSource)
      .where(
        and(
          eq(claimsSource.pending, true),
          or(isNull(claimsSource.jobDueAt), lte(claimsSource.jobDueAt, now)),
        ),
      )
      .orderBy(asc(claimsSource.recordedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toSource(row) : null;
  }

  async ofStation(stationId: StationId): Promise<readonly ClaimsSource[]> {
    const rows = await this.context.db
      .select()
      .from(claimsSource)
      .where(eq(claimsSource.stationId, stationId.value));

    return rows.map(toSource);
  }

  add(added: ClaimsSource): Promise<void> {
    return this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(claimsSource)
        .values({
          stationId: added.station.stationId.value,
          rubricVersion: added.rubricVersion,
          workspaceId: added.station.workspaceId.value,
          teamId: added.station.teamId.value,
          lineId: added.station.lineId.value,
          repository: added.commit.repository.value,
          sha: added.commit.sha,
          recordedAt: added.recordedAt,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({
          target: [claimsSource.stationId, claimsSource.rubricVersion],
        })
        .returning({ stationId: claimsSource.stationId });

      if (written.length === 0) {
        throw new ClaimsSourceVersionConflictError(
          added.station.stationId.value,
          added.rubricVersion,
        );
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  save(saved: ClaimsSource): Promise<void> {
    return this.context.inTransaction(async () => {
      const written = saved.isDeleted
        ? await this.context.db
            .delete(claimsSource)
            .where(at(saved))
            .returning({ stationId: claimsSource.stationId })
        : await this.context.db
            .update(claimsSource)
            .set({ version: saved.version + 1, ...columnsOf(saved) })
            .where(at(saved))
            .returning({ stationId: claimsSource.stationId });

      if (written.length === 0) {
        throw new ClaimsSourceVersionConflictError(
          saved.station.stationId.value,
          saved.rubricVersion,
        );
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly ClaimsSource[]> {
    const rows = await this.context.db
      .select()
      .from(claimsSource)
      .where(inScope(claimsSource, scope))
      .limit(max);

    return rows.map(toSource);
  }
}
