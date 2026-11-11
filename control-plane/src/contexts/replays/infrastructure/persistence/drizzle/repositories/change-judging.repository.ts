import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ChangeJudging } from '@replays/domain/aggregates/change-judging.aggregate';
import { ChangeJudgingVersionConflictError } from '@replays/domain/exceptions/change-judging-version-conflict.error';
import type { ChangeJudgingRepository } from '@replays/domain/repositories/change-judging.repository';
import {
  isJudgingAttempt,
  type JudgingAttempt,
} from '@replays/domain/value-objects/judging-attempt';
import { changeJudging } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
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

type Row = typeof changeJudging.$inferSelect;

const failureOf = (row: Row): JudgingFailure | null => {
  if ((row.failure === null) !== (row.failedAt === null)) {
    throw new InconsistentStateError(
      'change judging',
      'failed without saying when, or says when without a failure',
    );
  }

  return row.failure && row.failedAt
    ? JudgingFailure.of(row.failure, row.failedAt)
    : null;
};

const attemptOf = (row: Row): JudgingAttempt => {
  if (!isJudgingAttempt(row.attempt)) {
    throw new InconsistentStateError(
      'change judging',
      `is in an attempt no longer known, ${row.attempt}`,
    );
  }

  return row.attempt;
};

const toChangeJudging = (row: Row): ChangeJudging =>
  ChangeJudging.rehydrate({
    runId: RunId.of(row.runId),
    attempt: attemptOf(row),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    criteria: JudgeCriteria.of({
      rubric: row.rubric,
      claims: row.claims,
      passThreshold: row.passThreshold,
    }),
    reference: row.referenceRunId ? RunId.of(row.referenceRunId) : null,
    queuedAt: row.queuedAt,
    job: row.pending
      ? PendingJob.rehydrate({
          attempts: row.jobAttempts,
          nextAttemptAt: row.jobDueAt,
        })
      : null,
    judgedAt: row.judgedAt,
    failure: failureOf(row),
    version: row.version,
  });

const columnsOf = (stored: ChangeJudging) => ({
  pending: stored.job !== null,
  jobAttempts: stored.job?.attempts ?? 0,
  jobDueAt: stored.job?.nextAttemptAt ?? null,
  judgedAt: stored.judgedAt,
  failure: stored.failure?.code ?? null,
  failedAt: stored.failure?.at ?? null,
});

const keyOf = (judging: ChangeJudging) =>
  and(
    eq(changeJudging.runId, judging.runId.value),
    eq(changeJudging.attempt, judging.attempt),
    eq(changeJudging.version, judging.version),
  );

@Injectable()
export class DrizzleChangeJudgingRepository implements ChangeJudgingRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: ChangeJudging): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(changeJudging)
        .values({
          runId: added.runId.value,
          attempt: added.attempt,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId.value,
          rubric: added.criteria.rubric,
          claims: [...added.criteria.claims],
          passThreshold: added.criteria.passThreshold,
          referenceRunId: added.reference?.value ?? null,
          queuedAt: added.queuedAt,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({
          target: [changeJudging.runId, changeJudging.attempt],
        })
        .returning({ runId: changeJudging.runId });

      if (written.length === 0) {
        throw new ChangeJudgingVersionConflictError(added.runId.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: ChangeJudging): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = saved.isDeleted
        ? await this.context.db
            .delete(changeJudging)
            .where(keyOf(saved))
            .returning({ runId: changeJudging.runId })
        : await this.context.db
            .update(changeJudging)
            .set({ version: saved.version + 1, ...columnsOf(saved) })
            .where(keyOf(saved))
            .returning({ runId: changeJudging.runId });

      if (written.length === 0) {
        throw new ChangeJudgingVersionConflictError(saved.runId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(
    runId: RunId,
    attempt: JudgingAttempt,
  ): Promise<ChangeJudging | null> {
    const [row] = await this.context.db
      .select()
      .from(changeJudging)
      .where(
        and(
          eq(changeJudging.runId, runId.value),
          eq(changeJudging.attempt, attempt),
        ),
      )
      .limit(1);

    return row ? toChangeJudging(row) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly ChangeJudging[]> {
    const rows = await this.context.db
      .select()
      .from(changeJudging)
      .where(eq(changeJudging.teamId, teamId.value));

    return rows.map(toChangeJudging);
  }

  async nextDueJob(now: Date): Promise<ChangeJudging | null> {
    const [row] = await this.context.db
      .select()
      .from(changeJudging)
      .where(
        and(
          eq(changeJudging.pending, true),
          or(isNull(changeJudging.jobDueAt), lte(changeJudging.jobDueAt, now)),
        ),
      )
      .orderBy(asc(changeJudging.queuedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toChangeJudging(row) : null;
  }
}
