import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { SideBySideJudging } from '@replays/domain/aggregates/side-by-side-judging.aggregate';
import { SideBySideJudgingVersionConflictError } from '@replays/domain/exceptions/side-by-side-judging-version-conflict.error';
import type { SideBySideJudgingRepository } from '@replays/domain/repositories/side-by-side-judging.repository';
import { sideBySideJudging } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  modelSpentOf,
  storedSpent,
} from '@replays/infrastructure/persistence/drizzle/stored-model-spent';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { JudgingFailure } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';

type Row = typeof sideBySideJudging.$inferSelect;

const failureOf = (row: Row): JudgingFailure | null => {
  if ((row.failure === null) !== (row.failedAt === null)) {
    throw new InconsistentStateError(
      'side-by-side judging',
      'failed without saying when, or says when without a failure',
    );
  }

  return row.failure && row.failedAt
    ? JudgingFailure.of(row.failure, row.failedAt)
    : null;
};

const toSideBySideJudging = (row: Row): SideBySideJudging =>
  SideBySideJudging.rehydrate({
    runId: RunId.of(row.runId),
    otherRunId: RunId.of(row.otherRunId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    criteria: JudgeCriteria.of({
      rubric: row.rubric,
      claims: row.claims,
      passThreshold: row.passThreshold,
    }),
    reference: RunId.of(row.referenceRunId),
    maxAttempts: row.maxAttempts,
    order: row.shownOrder,
    queuedAt: row.queuedAt,
    job: row.pending
      ? PendingJob.rehydrate({
          attempts: row.jobAttempts,
          nextAttemptAt: row.jobDueAt,
        })
      : null,
    judgedAt: row.judgedAt,
    failure: failureOf(row),
    spent: modelSpentOf(row.spent),
    version: row.version,
  });

const columnsOf = (stored: SideBySideJudging) => ({
  pending: stored.job !== null,
  jobAttempts: stored.job?.attempts ?? 0,
  jobDueAt: stored.job?.nextAttemptAt ?? null,
  judgedAt: stored.judgedAt,
  failure: stored.failure?.code ?? null,
  failedAt: stored.failure?.at ?? null,
  spent: storedSpent(stored.spent),
});

const keyOf = (judging: SideBySideJudging) =>
  and(
    eq(sideBySideJudging.runId, judging.runId.value),
    eq(sideBySideJudging.otherRunId, judging.otherRunId.value),
    eq(sideBySideJudging.version, judging.version),
  );

const conflictOver = (judging: SideBySideJudging) =>
  new SideBySideJudgingVersionConflictError(
    judging.runId.value,
    judging.otherRunId.value,
  );

@Injectable()
export class DrizzleSideBySideJudgingRepository
  implements SideBySideJudgingRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: SideBySideJudging): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(sideBySideJudging)
        .values({
          runId: added.runId.value,
          otherRunId: added.otherRunId.value,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId.value,
          rubric: added.criteria.rubric,
          claims: [...added.criteria.claims],
          passThreshold: added.criteria.passThreshold,
          referenceRunId: added.reference.value,
          maxAttempts: added.maxAttempts,
          shownOrder: added.order,
          queuedAt: added.queuedAt,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({
          target: [sideBySideJudging.runId, sideBySideJudging.otherRunId],
        })
        .returning({ runId: sideBySideJudging.runId });

      if (written.length === 0) {
        throw conflictOver(added);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: SideBySideJudging): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = saved.isDeleted
        ? await this.context.db
            .delete(sideBySideJudging)
            .where(keyOf(saved))
            .returning({ runId: sideBySideJudging.runId })
        : await this.context.db
            .update(sideBySideJudging)
            .set({ version: saved.version + 1, ...columnsOf(saved) })
            .where(keyOf(saved))
            .returning({ runId: sideBySideJudging.runId });

      if (written.length === 0) {
        throw conflictOver(saved);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(runId: RunId, otherRunId: RunId): Promise<SideBySideJudging | null> {
    const [row] = await this.context.db
      .select()
      .from(sideBySideJudging)
      .where(
        and(
          eq(sideBySideJudging.runId, runId.value),
          eq(sideBySideJudging.otherRunId, otherRunId.value),
        ),
      )
      .limit(1);

    return row ? toSideBySideJudging(row) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly SideBySideJudging[]> {
    const rows = await this.context.db
      .select()
      .from(sideBySideJudging)
      .where(eq(sideBySideJudging.teamId, teamId.value));

    return rows.map(toSideBySideJudging);
  }

  async nextDueJob(now: Date): Promise<SideBySideJudging | null> {
    const [row] = await this.context.db
      .select()
      .from(sideBySideJudging)
      .where(
        and(
          eq(sideBySideJudging.pending, true),
          or(
            isNull(sideBySideJudging.jobDueAt),
            lte(sideBySideJudging.jobDueAt, now),
          ),
        ),
      )
      .orderBy(asc(sideBySideJudging.queuedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toSideBySideJudging(row) : null;
  }
}
