import { Inject, Injectable } from '@nestjs/common';
import { Judging } from '@outcomes/domain/aggregates/judging.aggregate';
import { JudgingVersionConflictError } from '@outcomes/domain/exceptions/judging-version-conflict.error';
import type { JudgingRepository } from '@outcomes/domain/repositories/judging.repository';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { judging } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { OwedWork } from '@shared-kernel/domain/value-objects/owed-work.vo';
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
    place: RunPlace.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
      taskId: TaskId.of(row.taskId),
    }),
    fingerprint: row.fingerprint,
    rubric: Rubric.of({
      text: row.rubric,
      claims: row.claims,
      passShare: row.passShare,
      version: row.rubricVersion,
    }),
    askedAt: row.askedAt,
    work: row.owed
      ? OwedWork.rehydrate({
          attempts: row.workAttempts,
          dueAt: row.workDueAt,
        })
      : null,
    judgedAt: row.judgedAt,
    failure: failureOf(row),
    version: row.version,
  });

const columnsOf = (held: Judging) => ({
  owed: held.work !== null,
  workAttempts: held.work?.attempts ?? 0,
  workDueAt: held.work?.dueAt ?? null,
  judgedAt: held.judgedAt,
  failure: held.failure?.code ?? null,
  failedAt: held.failure?.at ?? null,
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
          teamId: added.place.teamId.value,
          lineId: added.place.lineId,
          stationId: added.place.stationId,
          taskId: added.place.taskId.value,
          fingerprint: added.fingerprint,
          rubric: added.rubric.text,
          claims: [...added.rubric.criteria.claims],
          passShare: added.rubric.criteria.passShare,
          rubricVersion: added.rubric.version,
          askedAt: added.askedAt,
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

  async dueForWork(now: Date): Promise<Judging | null> {
    const [row] = await this.context.db
      .select()
      .from(judging)
      .where(
        and(
          eq(judging.owed, true),
          or(isNull(judging.workDueAt), lte(judging.workDueAt, now)),
        ),
      )
      .orderBy(asc(judging.askedAt))
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
