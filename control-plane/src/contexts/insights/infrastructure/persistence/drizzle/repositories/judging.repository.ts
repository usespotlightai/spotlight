import { Judging } from '@insights/domain/aggregates/judging.aggregate';
import { JudgingVersionConflictError } from '@insights/domain/exceptions/judging-version-conflict.error';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { judging } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';

type JudgingRow = typeof judging.$inferSelect;

const failureOf = (row: JudgingRow): JudgingFailure | null => {
  if ((row.failure === null) !== (row.failedAt === null)) {
    throw new InconsistentStateError(
      'judging',
      'failed without saying when, or says when without a failure',
    );
  }

  return row.failure && row.failedAt
    ? JudgingFailure.of(row.failure, row.failedAt)
    : null;
};

const toJudging = (row: JudgingRow): Judging =>
  Judging.rehydrate({
    runId: RunId.of(row.runId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    location: RunLocation.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
      taskId: TaskId.of(row.taskId),
    }),
    fingerprint: row.fingerprint,
    rubric: Rubric.of({
      text: row.rubric,
      claims: row.claims,
      passThreshold: row.passThreshold,
      version: row.rubricVersion,
    }),
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

const columnsOf = (stored: Judging) => ({
  pending: stored.job !== null,
  jobAttempts: stored.job?.attempts ?? 0,
  jobDueAt: stored.job?.nextAttemptAt ?? null,
  judgedAt: stored.judgedAt,
  failure: stored.failure?.code ?? null,
  failedAt: stored.failure?.at ?? null,
});

@Injectable()
export class DrizzleJudgingRepository implements JudgingRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Judging): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(judging)
        .values({
          runId: added.runId.value,
          workspaceId: added.workspaceId.value,
          teamId: added.location.teamId.value,
          lineId: added.location.lineId,
          stationId: added.location.stationId,
          taskId: added.location.taskId.value,
          fingerprint: added.fingerprint,
          rubric: added.rubric.text,
          claims: [...added.rubric.criteria.claims],
          passThreshold: added.rubric.criteria.passThreshold,
          rubricVersion: added.rubric.version,
          queuedAt: added.queuedAt,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({ target: judging.runId })
        .returning({ runId: judging.runId });

      if (written.length === 0) {
        throw new JudgingVersionConflictError(added.runId.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Judging): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(judging)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            eq(judging.runId, saved.runId.value),
            eq(judging.version, saved.version),
          ),
        )
        .returning({ runId: judging.runId });

      if (written.length === 0) {
        throw new JudgingVersionConflictError(saved.runId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(runId: RunId): Promise<Judging | null> {
    const [row] = await this.context.db
      .select()
      .from(judging)
      .where(eq(judging.runId, runId.value))
      .limit(1);

    return row ? toJudging(row) : null;
  }

  async ofForScoring(runId: RunId): Promise<Judging | null> {
    const [row] = await this.context.db
      .select()
      .from(judging)
      .where(eq(judging.runId, runId.value))
      .limit(1)
      .for('update');

    return row ? toJudging(row) : null;
  }

  async nextDueJob(now: Date): Promise<Judging | null> {
    const [row] = await this.context.db
      .select()
      .from(judging)
      .where(
        and(
          eq(judging.pending, true),
          or(isNull(judging.jobDueAt), lte(judging.jobDueAt, now)),
        ),
      )
      .orderBy(asc(judging.queuedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toJudging(row) : null;
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(judging)
      .where(eq(judging.taskId, taskId.value));
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(judging)
      .where(
        and(
          eq(judging.workspaceId, workspaceId.value),
          eq(judging.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(judging)
      .where(eq(judging.workspaceId, workspaceId.value));
  }
}
